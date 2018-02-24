const StellarSdk = require('stellar-sdk')
const $ = require('jquery')
import StellarAccounts from './StellarAccounts.js'
import StellarServer from './StellarServer.js'
import Helper from '../js/helper.js'
import {
  StellarWallet,
  LedgerAPI
} from 'stellar-js-utils'
import axios from 'axios'

class StellarUtils {
  constructor() {
    this.s = new StellarServer()
  }

  server() {
    return this.s.server()
  }

  friendBotServer() {
    return this.s.friendBotServer()
  }

  lumins() {
    return StellarSdk.Asset.native()
  }

  assetFromObject(object) {
    if (!object.asset_issuer) {
      return StellarSdk.Asset.native()
    }

    return new StellarSdk.Asset(object.asset_code, object.asset_issuer)
  }

  api() {
    return this.s.serverAPI()
  }

  horizonMetrics() {
    return this.api().horizonMetrics()
  }

  accountInfo(publicKey) {
    return this.api().accountInfo(publicKey)
  }

  paths(sourcePublic, destinationPublic, destinationAsset, destinationAmount) {
    return this.api().paths(sourcePublic, destinationPublic, destinationAsset, destinationAmount).call()
  }

  balances(publicKey) {
    return this.api().balances(publicKey)
  }

  manageData(sourceWallet, fundingWallet, name, value) {
    return this.api().manageData(sourceWallet, fundingWallet, name, value)
  }

  mergeAccount(sourceWallet, destKey) {
    return this.api().mergeAccount(sourceWallet, destKey)
  }

  manageOffer(sourceWallet, fundingWallet, buying, selling, amount, price, offerID = 0) {
    return this.api().manageOffer(sourceWallet, fundingWallet, buying, selling, amount, price, offerID)
  }

  changeTrust(sourceWallet, asset, amount) {
    return this.api().changeTrust(sourceWallet, asset, amount)
  }

  allowTrust(sourceWallet, trustor, asset, authorize) {
    return this.api().allowTrust(sourceWallet, trustor, asset, authorize)
  }

  setDomain(sourceWallet, domain) {
    return this.api().setDomain(sourceWallet, domain)
  }

  // pass 1 for threshold if either account can sign for med/high operations
  makeMultiSig(sourceWallet, publicKey, threshold) {
    return this.api().makeMultiSig(sourceWallet, publicKey, threshold)
  }

  removeMultiSig(sourceWallet, secondWallet, transactionOpts) {
    return this.api().removeMultiSig(sourceWallet, secondWallet, transactionOpts)
  }

  // get the transaction for later submission
  removeMultiSigTransaction(sourceWallet, secondWallet, transactionOpts) {
    return this.api().removeMultiSigTransaction(sourceWallet, secondWallet, transactionOpts)
  }

  submitTransaction(transaction) {
    return this.api().submitTransaction(transaction)
  }

  // additionalSigners is an array of StellarWallet (ledger or secret key)
  sendAsset(sourceWallet, fundingWallet, destKey, amount, asset = null, memo = null, additionalSigners = null) {
    return this.api().sendAsset(sourceWallet, fundingWallet, destKey, amount, asset, memo, additionalSigners)
  }

  buyTokens(sourceWallet, sendAsset, destAsset, sendMax, destAmount) {
    return this.api().buyTokens(sourceWallet, sendAsset, destAsset, sendMax, destAmount)
  }

  lockAccount(sourceWallet) {
    return this.api().lockAccount(sourceWallet)
  }

  createAccount(sourceWallet, destinationKey, startingBalance) {
    return this.api().createAccount(sourceWallet, destinationKey, startingBalance)
  }

  setOptions(sourceWallet, options) {
    return this.api().setOptions(sourceWallet, options)
  }

  setFlags(sourceWallet, flags) {
    return this.api().setFlags(sourceWallet, flags)
  }

  clearFlags(sourceWallet, flags) {
    return this.api().clearFlags(sourceWallet, flags)
  }

  setInflationDestination(sourceWallet, inflationDest) {
    return this.api().setInflationDestination(sourceWallet, inflationDest)
  }

  // returns {account: newAccount, keypair: keypair}
  newAccount(sourceWallet, startingBalance, name = null, tag = null) {
    const keypair = StellarSdk.Keypair.random()

    Helper.debugLog('creating account...')
    Helper.debugLog(keypair.publicKey())
    Helper.debugLog(keypair.secret())

    return this.createAccount(sourceWallet, keypair.publicKey(), startingBalance)
      .then((account) => {
        StellarAccounts.addAccount(keypair, name, false, tag)

        return {
          account: account,
          keypair: keypair
        }
      })
  }

  // returns {account: newAccount, keypair: keypair}
  newAccountWithTokens(sourceWallet, distributorWallet, startingBalance, asset, amount, accountName = null, accountTag = null) {
    let info = null

    return this.newAccount(sourceWallet, startingBalance, accountName, accountTag)
      .then((result) => {
        info = result

        // just make sure limit is at least > amount, but boosting it up just in case
        const trustLimit = Math.max(amount * 2, 100000)

        Helper.debugLog('setting trust...')
        return this.changeTrust(StellarWallet.secret(info.keypair.secret()), asset, String(trustLimit))
      })
      .then((result) => {
        Helper.debugLog('sending tokens...')
        return this.sendAsset(distributorWallet, null, info.keypair.publicKey(), amount, asset)
      })
      .then((result) => {
        Helper.debugLog(result, 'Success')
        this.updateBalances()

        return info
      })
  }

  displayLedgerInfo() {
    const fundingWallet = StellarWallet.ledger(new LedgerAPI())
    fundingWallet.publicKey()
      .then((publicKey) => {
        return this.api().accountInfo(publicKey)
      })
      .then((info) => {
        Helper.debugLog(info)
      })
  }

  sendTestnetXLMToLedger() {
    let ledgerPublicKey

    Helper.debugLog('refilling ledger...')

    const fundingWallet = StellarWallet.ledger(new LedgerAPI())
    fundingWallet.publicKey()
      .then((publicKey) => {
        const url = 'https://horizon-testnet.stellar.org/friendbot' + '?addr=' + publicKey

        ledgerPublicKey = publicKey

        return axios.get(url)
      })
      .then((info) => {
        Helper.debugLog(info)
      })
      .catch((error) => {
        Helper.debugLog(error, 'Error')

        // we get op_already_exists if this account already exists, so create new account and merge
        if (Helper.strOK(ledgerPublicKey)) {
          Helper.debugLog('creating new account and merging...')

          const keyPair = StellarSdk.Keypair.random()
          const url = 'https://horizon-testnet.stellar.org/friendbot' + '?addr=' + keyPair.publicKey()
          return axios.get(url)
            .then((data) => {
              Helper.debugLog(data, 'Success')

              return this.api().mergeAccount(StellarWallet.secret(keyPair.secret()), ledgerPublicKey)
            })
        }
      })
  }

  createTestAccount(name = null) {
    return new Promise((resolve, reject) => {
      const keyPair = StellarSdk.Keypair.random()

      const accountRec = StellarAccounts.addAccount(keyPair, name)

      const url = 'https://horizon-testnet.stellar.org/friendbot' + '?addr=' + keyPair.publicKey()

      $.get(url, (data) => {
        Helper.debugLog(data, 'Success')

        // refresh balance on just this account
        // asking same server as friendbot assuming our node might not be 100% synced?
        this.friendBotServer().loadAccount(keyPair.publicKey())
          .then((account) => {
            account.balances.forEach((balance) => {
              if (balance.asset_type === 'native') {
                accountRec.balances.XLM = balance.balance
              } else {
                accountRec.balances[balance.asset_code] = balance.balance
              }
            })

            StellarAccounts.replaceAccountWithPublicKey(accountRec, accountRec.publicKey)

            resolve(accountRec)
          })
          .catch((error) => {
            Helper.debugLog(error, 'Error')

            // delete the account friend bot failed
            StellarAccounts.replaceAccountWithPublicKey(null, accountRec.publicKey)

            reject(error)
          })
      }, 'json').fail((err) => {
        reject(err)
      })
    })
  }

  updateBalances(logSuccess = false) {
    for (let i = 0; i < StellarAccounts.accounts().length; i++) {
      const publicKey = StellarAccounts.publicKey(i)

      this.balances(publicKey)
        .then((balanceObject) => {
          for (const key in balanceObject) {
            StellarAccounts.updateBalance(i, key, balanceObject[key])
          }

          if (logSuccess) {
            Helper.debugLog(publicKey, 'Success')
          }

          return null
        })
        .catch((error) => {
          StellarAccounts.updateBalance(i, 'XLM', 'ERROR')

          Helper.debugLog(error, 'Error')
        })
    }
  }
}

const instance = new StellarUtils()
Object.freeze(instance)

export default instance
