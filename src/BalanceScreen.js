// Copyright (C) 2018-2019, Zpalmtree
//
// Please see the included LICENSE file for more information.

import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';

import Ionicons from 'react-native-vector-icons/Ionicons';

import { Globals } from './Globals';
import { Themes } from './Themes';
import { prettyPrintAmount } from 'kryptokrona-wallet-backend-js';

// Import per tentare derivazione della public spend key (se disponibile nel native)
import { secretKeyToPublicKey } from './NativeCode';

export default class BalanceScreen extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            balanceTotal: null,
            unlockedBalance: null,
            lockedBalance: null,
            keys: null,
            loading: false,
            deriving: false,
        };
    }

    componentDidMount() {
        this.refreshAll();
    }

    refreshAll = async () => {
        this.setState({ loading: true });

        try {
            // Carichiamo prima le chiavi (possono essere utili per debug/derivazioni),
            // poi aggiorniamo il bilancio.
            await this.loadKeys();
            await this.refreshBalance();
        } catch (err) {
            Alert.alert('Errore', err && err.message ? err.message : String(err));
            console.warn('refreshAll error:', err);
        } finally {
            this.setState({ loading: false });
        }
    };

    /**
     * refreshBalance:
     * - gestisce sia il caso in cui wallet.getBalance() ritorni un array [unlocked, locked]
     * - sia il caso in cui ritorni un oggetto { balance, unlockedBalance, lockedBalance } o varianti
     */
    refreshBalance = async () => {
        const wallet = Globals.wallet;

        if (!wallet) {
            throw new Error('Wallet non inizializzato');
        }

        let balanceRes;
        try {
            balanceRes = await wallet.getBalance();
        } catch (err) {
            // Log e rilancio per gestione superiore
            console.warn('getBalance error:', err);
            throw err;
        }

        let total = null;
        let unlocked = null;
        let locked = null;

        // Caso array: [unlocked, locked]
        if (Array.isArray(balanceRes)) {
            unlocked = typeof balanceRes[0] === 'number' ? balanceRes[0] : null;
            locked = typeof balanceRes[1] === 'number' ? balanceRes[1] : null;
            if (unlocked !== null && locked !== null) total = unlocked + locked;
        } else if (balanceRes && typeof balanceRes === 'object') {
            // Oggetto comune: { balance, unlockedBalance, lockedBalance }
            if (typeof balanceRes.unlockedBalance === 'number') unlocked = balanceRes.unlockedBalance;
            if (typeof balanceRes.lockedBalance === 'number') locked = balanceRes.lockedBalance;
            if (typeof balanceRes.balance === 'number') total = balanceRes.balance;

            // fallback con nomi alternativi
            if (unlocked === null && typeof balanceRes.unlocked === 'number') unlocked = balanceRes.unlocked;
            if (locked === null && typeof balanceRes.locked === 'number') locked = balanceRes.locked;
            if (total === null && unlocked !== null && locked !== null) total = unlocked + locked;
        } else if (typeof balanceRes === 'number') {
            // se la API ritornasse un singolo numero (raro), trattalo come totale
            total = balanceRes;
        } else {
            console.warn('Formato balanceRes non riconosciuto:', balanceRes);
        }

        this.setState({
            balanceTotal: total,
            unlockedBalance: unlocked,
            lockedBalance: locked,
        });
    };

    /**
     * loadKeys:
     * prova vari nomi di metodi esposti dal wallet e ritorna le prime chiavi disponibili.
     * Se la public spend key non è esposta, tenta di derivarla dalla private spend key
     * usando secretKeyToPublicKey (se presente in NativeCode).
     */
    loadKeys = async () => {
        const wallet = Globals.wallet;

        if (!wallet) {
            throw new Error('Wallet non inizializzato');
        }

        const keys = {
            address: 'non disponibile',
            viewKey: 'non disponibile',
            spendKey: 'non disponibile', // qui esponiamo la public spend key (o indicazione)
            privateSpendKey: null,       // se riusciamo a leggerla la salviamo (ma non la mostriamo)
        };

        // --- Address ---
        try {
            if (typeof wallet.getPrimaryAddress === 'function') {
                keys.address = await wallet.getPrimaryAddress();
            } else if (typeof wallet.getAddress === 'function') {
                keys.address = await wallet.getAddress();
            }
        } catch (e) {
            console.warn('getPrimaryAddress error:', e);
            keys.address = 'errore recupero indirizzo';
        }

        // --- View key (proviamo più varianti) ---
        try {
            if (typeof wallet.getViewKey === 'function') {
                keys.viewKey = await wallet.getViewKey();
            } else if (typeof wallet.getPublicViewKey === 'function') {
                keys.viewKey = await wallet.getPublicViewKey();
            } else if (typeof wallet.getPrivateViewKey === 'function') {
                keys.viewKey = await wallet.getPrivateViewKey();
            }
        } catch (e) {
            console.warn('viewKey retrieval error:', e);
            keys.viewKey = 'errore recupero view key';
        }

        // --- Spend key (cerchiamo public prima, poi private, poi tentiamo derivazione) ---
        try {
            // 1) public spend key esposta direttamente?
            if (typeof wallet.getPublicSpendKey === 'function') {
                const pub = await wallet.getPublicSpendKey();
                if (pub) {
                    keys.spendKey = pub;
                }
            }

            // 2) se non ho public, provo a leggere private (se disponibile)
            if ((keys.spendKey === 'non disponibile' || !keys.spendKey) && typeof wallet.getPrivateSpendKey === 'function') {
                try {
                    const priv = await wallet.getPrivateSpendKey();
                    if (priv) {
                        keys.privateSpendKey = priv;
                        // se ho secretKeyToPublicKey dal native, provo a derivare public
                        if (typeof secretKeyToPublicKey === 'function') {
                            try {
                                const derivedPub = await secretKeyToPublicKey(priv);
                                if (derivedPub) {
                                    keys.spendKey = derivedPub;
                                } else {
                                    console.warn('secretKeyToPublicKey ha ritornato valore vuoto');
                                }
                            } catch (err) {
                                console.warn('Errore derivazione public spend key:', err);
                            }
                        } else {
                            // non possiamo derivare qui, segnalo che abbiamo la private ma non la public
                            keys.spendKey = '(private presente, public non esposta)';
                        }
                    }
                } catch (err) {
                    console.warn('getPrivateSpendKey error:', err);
                }
            }

            // 3) alcune build espongono getSpendKey (potrebbe essere public o private)
            if ((keys.spendKey === 'non disponibile' || !keys.spendKey) && typeof wallet.getSpendKey === 'function') {
                try {
                    const k = await wallet.getSpendKey();
                    if (k) {
                        // Se abbiamo secretKeyToPublicKey e k sembra una private key (64 hex),
                        // tentiamo derivazione per mostrare la public.
                        if (typeof secretKeyToPublicKey === 'function' && /^[0-9a-fA-F]{64}$/.test(k)) {
                            try {
                                const derived = await secretKeyToPublicKey(k);
                                if (derived) {
                                    keys.spendKey = derived;
                                    keys.privateSpendKey = k;
                                } else {
                                    keys.spendKey = '(spendkey non esposta)';
                                }
                            } catch (err) {
                                console.warn('Derivazione da getSpendKey fallita:', err);
                                keys.spendKey = '(spendkey non esposta)';
                            }
                        } else {
                            // Se non possiamo derivare, assumiamo che k sia la public direttamente
                            keys.spendKey = k;
                        }
                    }
                } catch (err) {
                    console.warn('getSpendKey error:', err);
                }
            }
        } catch (e) {
            console.warn('spendKey retrieval error (generico):', e);
        }

        // Imposta stato (non mostriamo la privateSpendKey nella UI, ma la teniamo per debug interno)
        this.setState({ keys });
    };

    // Metodo opzionale esposto nell'interfaccia per forzare la derivazione della public spend key
    derivePublicSpendKeyManually = async () => {
        const wallet = Globals.wallet;
        if (!wallet) {
            Alert.alert('Errore', 'Wallet non inizializzato');
            return;
        }
        if (typeof secretKeyToPublicKey !== 'function') {
            Alert.alert('Non possibile', 'secretKeyToPublicKey non è disponibile nel modulo native.');
            return;
        }

        this.setState({ deriving: true });

        try {
            // proviamo a leggere la private spend key dal wallet
            let priv = null;
            if (typeof wallet.getPrivateSpendKey === 'function') {
                priv = await wallet.getPrivateSpendKey();
            } else if (typeof wallet.getSpendKey === 'function') {
                // se getSpendKey restituisce private
                const k = await wallet.getSpendKey();
                if (k && /^[0-9a-fA-F]{64}$/.test(k)) priv = k;
            }

            if (!priv) {
                Alert.alert('Impossibile', 'Private spend key non disponibile nel wallet per derivare la public.');
                return;
            }

            const pub = await secretKeyToPublicKey(priv);
            if (pub) {
                const keys = this.state.keys || {};
                keys.spendKey = pub;
                keys.privateSpendKey = priv;
                this.setState({ keys });
                Alert.alert('Derivazione avvenuta', 'Public spend key derivata correttamente.');
            } else {
                Alert.alert('Errore', 'Derivazione non ha restituito una chiave valida.');
            }
        } catch (err) {
            console.warn('derivePublicSpendKeyManually error:', err);
            Alert.alert('Errore', err && err.message ? err.message : String(err));
        } finally {
            this.setState({ deriving: false });
        }
    };

    renderKey(label, value) {
        const theme = this.props.screenProps && this.props.screenProps.theme ? this.props.screenProps.theme : Themes.darkMode;
        return (
            <View style={styles.keyBox}>
                <Text style={[styles.keyLabel, { color: theme.primaryColour }]}>
                    {label}
                </Text>
                <Text selectable={true} style={[styles.keyValue, { color: theme.textColour }]}>
                    {value}
                </Text>
            </View>
        );
    }

    formatNumberForDisplay(value) {
        if (value === null || value === undefined) return '—';
        try {
            if (typeof prettyPrintAmount === 'function') {
                try {
                    return prettyPrintAmount(value, /* Config */ undefined);
                } catch (e) {
                    return String(value);
                }
            }
            return String(value);
        } catch (e) {
            return String(value);
        }
    }

    render() {
        const theme = this.props.screenProps && this.props.screenProps.theme ? this.props.screenProps.theme : Themes.darkMode;
        const { balanceTotal, unlockedBalance, lockedBalance, keys, loading, deriving } = this.state;

        return (
            <ScrollView
                style={[styles.container, { backgroundColor: theme.backgroundColour }]}
                contentContainerStyle={styles.content}
            >
                {/* BILANCIO */}
                <View style={styles.section}>
                    <Text style={[styles.title, { color: theme.primaryColour }]}>
                        Bilancio
                    </Text>

                    <Text style={[styles.value, { color: theme.textColour }]}>
                        Saldo totale: {this.formatNumberForDisplay(balanceTotal)}
                    </Text>

                    <Text style={[styles.value, { color: theme.textColour }]}>
                        Saldo spendibile: {this.formatNumberForDisplay(unlockedBalance)}
                    </Text>

                    <Text style={[styles.value, { color: theme.textColour }]}>
                        Saldo bloccato: {this.formatNumberForDisplay(lockedBalance)}
                    </Text>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.primaryColour }]}
                        onPress={this.refreshAll}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                        ) : (
                            <Ionicons name="ios-refresh" size={20} color="#fff" />
                        )}
                        <Text style={styles.buttonText}>
                            {loading ? 'Aggiornamento...' : 'Aggiorna saldo'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* CHIAVI */}
                <View style={styles.section}>
                    <Text style={[styles.title, { color: theme.primaryColour }]}>
                        Chiavi del wallet
                    </Text>

                    {keys ? (
                        <>
                            {this.renderKey('Indirizzo pubblico', keys.address)}
                            {this.renderKey('View key (public/private)', keys.viewKey)}
                            {this.renderKey('Public spend key (o info)', keys.spendKey)}
                            {/* Se abbiamo private spend in stato, non la mostriamo pienamente ma indichiamo la presenza */}
                            {keys.privateSpendKey ? this.renderKey('Private spend key (presente)', '(hidden)') : null}

                            {/* Bottone per tentare la derivazione manuale, visibile se la public non è disponibile */}
                            {(keys.spendKey === 'non disponibile' || keys.spendKey === '(private presente, public non esposta)') && (
                                <TouchableOpacity
                                    style={[styles.secondaryButton, { borderColor: theme.primaryColour }]}
                                    onPress={this.derivePublicSpendKeyManually}
                                    disabled={deriving}
                                >
                                    {deriving ? (
                                        <ActivityIndicator size="small" color={theme.primaryColour} style={{ marginRight: 8 }} />
                                    ) : (
                                        <Ionicons name="ios-key" size={18} color={theme.primaryColour} />
                                    )}
                                    <Text style={[styles.secondaryButtonText, { color: theme.primaryColour }]}>
                                        {deriving ? 'Derivazione...' : 'Deriva public spend'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <Text style={{ color: theme.textColour }}>
                            Chiavi non disponibili
                        </Text>
                    )}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    section: {
        marginBottom: 30,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    value: {
        fontSize: 16,
        marginBottom: 6,
    },
    button: {
        marginTop: 15,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        marginLeft: 8,
        fontWeight: 'bold',
    },
    secondaryButton: {
        marginTop: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    secondaryButtonText: {
        fontSize: 14,
        marginLeft: 8,
        fontWeight: '600',
    },
    keyBox: {
        marginBottom: 15,
    },
    keyLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    keyValue: {
        fontSize: 13,
        opacity: 0.95,
    },
});