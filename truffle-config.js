/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 */

// For ES6 support, needed for package LedgerWalletProvider
// https://github.com/LedgerHQ/ledgerjs/issues/266
require('babel-polyfill');
require('dotenv').config();


const LedgerWalletProvider = require('truffle-ledger-provider');
const PrivateKeyProvider = require('truffle-privatekey-provider');


// hot wallet meant for temporary use cases
const privateKey = process.env.HOT_PRIVATE_KEY;

const infuraKey = process.env.INFURA_KEY;

const rinkebyLedgerOptions = {
  networkId: 4, // rinkeby
  path: '44\'/60\'/0\'/0', // ledger default derivation path
  askConfirm: false,
  accountsLength: 1,
  accountsOffset: 0
};

const mainnetLedgerOptions = {
  networkId: 1, // mainnet
  path: '44\'/60\'/0\'/0', // ledger default derivation path
  askConfirm: false,
  accountsLength: 1,
  accountsOffset: 0
};


module.exports = {
  contracts_build_directory: './build/ethereum-contracts',

  contracts_directory: './contracts',

  test_directory: './test',

  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */
  networks: {
    development: {
      host: '127.0.0.1',
      port: 7545,
      gas: 2000000,
      network_id: '*' // Match any network id, eg Ganache
    },
    rinkebyLedger: {
      provider: new LedgerWalletProvider(rinkebyLedgerOptions, `https://rinkeby.infura.io/v3/${infuraKey}`),
      network_id: 4,
      gasPrice: 3000000000
    },
    rinkebyPrivateKey: {
      provider: new PrivateKeyProvider(privateKey, `https://rinkeby.infura.io/v3/${infuraKey}`),
      network_id: 4,
      gasPrice: 3000000000
    },
    mainnetLedger: {
      provider: new LedgerWalletProvider(mainnetLedgerOptions, `https://mainnet.infura.io/v3/${infuraKey}`),
      network_id: 1,
      gasPrice: 11000000000
    },
    mainnetPrivateKey: {
      provider: new PrivateKeyProvider(privateKey, `https://mainnet.infura.io/v3/${infuraKey}`),
      network_id: 1,
      gasPrice: 6500000000
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  plugins: [
    'truffle-security'
  ],

  // Configure your compilers
  compilers: {
    solc: {
      version: '0.6.12', // Fetch exact version from solc-bin (default: truffle's version)
      settings: { // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: false,
          runs: 200
        },
        evmVersion: 'istanbul'
      }
    }
  }
};
