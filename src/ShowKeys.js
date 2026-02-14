/**
 * ShowcaseKeys.js
 * ---------------------------------------------------
 * DEBUG SCREEN
 * Visualizza tutte le chiavi del wallet attualmente
 * caricato nell'applicazione.
 *
 * USO ESCLUSIVO PER VERIFICA / DEBUG
 * ---------------------------------------------------
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert
} from 'react-native';

import { WalletBackend } from 'kryptokrona-wallet-backend-js';

const ShowcaseKeys = () => {

  const [keys, setKeys] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {

      const wallet = WalletBackend.getWallet();

      if (!wallet) {
        throw new Error('Wallet non inizializzato');
      }

      const privateSpendKey = wallet.getPrivateSpendKey();
      const publicSpendKey  = wallet.getPublicSpendKey();
      const privateViewKey  = wallet.getPrivateViewKey();
      const publicViewKey   = wallet.getPublicViewKey();
      const address         = wallet.getPrimaryAddress();

      setKeys({
        address,
        privateSpendKey,
        publicSpendKey,
        privateViewKey,
        publicViewKey
      });

    } catch (e) {
      console.error(e);
      setError(e.message);
    }
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Errore: {error}</Text>
      </View>
    );
  }

  if (!keys) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Caricamento chiavi…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>

      <Text style={styles.warning}>
        ⚠️ SCHERMATA DI DEBUG
        {"\n"}NON USARE IN PRODUZIONE
      </Text>

      <KeyBlock label="Indirizzo Wallet" value={keys.address} />
      <KeyBlock label="Private Spend Key" value={keys.privateSpendKey} />
      <KeyBlock label="Public Spend Key" value={keys.publicSpendKey} />
      <KeyBlock label="Private View Key" value={keys.privateViewKey} />
      <KeyBlock label="Public View Key" value={keys.publicViewKey} />

    </ScrollView>
  );
};

/* -------------------------------------------------- */
/* COMPONENTE RIUTILIZZABILE                           */
/* -------------------------------------------------- */

const KeyBlock = ({ label, value }) => (
  <View style={styles.block}>
    <Text style={styles.label}>{label}</Text>
    <Text selectable style={styles.value}>
      {value}
    </Text>
  </View>
);

/* -------------------------------------------------- */
/* STILI                                              */
/* -------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#0b0b0b'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  warning: {
    color: '#ff5555',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold'
  },
  loading: {
    color: '#ffffff'
  },
  error: {
    color: '#ff3333'
  },
  block: {
    marginBottom: 18,
    padding: 12,
    backgroundColor: '#161616',
    borderRadius: 8
  },
  label: {
    color: '#aaaaaa',
    fontSize: 12,
    marginBottom: 6
  },
  value: {
    color: '#00ffcc',
    fontSize: 13
  }
});

export default ShowcaseKeys;