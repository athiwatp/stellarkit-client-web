<template>
<div>
  <account-list :items="accountsUI" />

  <instructions-header>
    <div>Content coming soon...</div>
  </instructions-header>

  <div class='main-container'>
    <div class='user-area'>
      <div>Sign up for a free account</div>
      <div class='user-buttons'>
        <v-btn round small color='primary' @click="createAccount" :loading='loading'>Create Account</v-btn>
        <v-btn round small color='primary' @click="buyAssetDialogPing = !buyAssetDialogPing" :loading='loadingBuy'>Buy</v-btn>
        <v-btn round small color='primary' @click="sendAssetsDialogPing = !sendAssetsDialogPing" :loading='loadingSend'>Send</v-btn>
      </div>
    </div>

    <div class='admin-area'>
      <div>Admin</div>
      <dialog-accounts ref='dialogAccounts' v-on:enter-key-down='adminEnterKey' :showSource=true :showFunding=true :showAsset=true />
    </div>

  </div>

  <send-assets-dialog :ping='sendAssetsDialogPing' />
  <buy-asset-dialog :ping='buyAssetDialogPing' />
</div>
</template>

<script>
import Helper from '../js/helper.js'
import StellarCommonMixin from '../components/StellarCommonMixin.js'
import InstructionsHeader from '../components/InstructionsHeader.vue'
import AccountList from '../components/AccountList.vue'
import DialogAccountsView from '../components/dialogs/DialogAccountsView.vue'
import StellarUtils from '../js/StellarUtils.js'
import {
  StellarWallet
} from 'stellar-js-utils'
import SendAssetsDialog from '../components/dialogs/SendAssetsDialog.vue'
import BuyAssetDialog from '../components/dialogs/BuyAssetDialog.vue'

export default {
  mixins: [StellarCommonMixin],
  data() {
    return {
      loading: false,
      loadingBuy: false,
      loadingSend: false,
      buyAssetDialogPing: false,
      sendAssetsDialogPing: false
    }
  },
  components: {
    'account-list': AccountList,
    'instructions-header': InstructionsHeader,
    'dialog-accounts': DialogAccountsView,
    'buy-asset-dialog': BuyAssetDialog,
    'send-assets-dialog': SendAssetsDialog
  },
  methods: {
    dialogAccounts() {
      return this.$refs.dialogAccounts
    },
    adminEnterKey() {
      Helper.debugLog('nothing')
    },
    createAccount() {
      const signerWallet = this.dialogAccounts().sourceWallet()
      const asset = this.dialogAccounts().asset()
      let fundingWallet = this.dialogAccounts().fundingWallet()
      let userWallet = null
      const startingBalance = 3

      if (!fundingWallet) {
        fundingWallet = signerWallet
      }

      if (signerWallet && asset) {
        this.loading = true

        // create issuer
        StellarUtils.newAccount(fundingWallet, String(startingBalance))
          .then((accountInfo) => {
            userWallet = StellarWallet.secret(accountInfo.keypair.secret())
            if (!userWallet) {
              throw new Error('userWallet null')
            }

            const trustLimit = 1000000

            Helper.debugLog('setting trust...')
            return StellarUtils.changeTrust(userWallet, fundingWallet, asset, String(trustLimit))
          })
          .then((result) => {
            Helper.debugLog('adding multi sig...')
            return StellarUtils.makeMultiSig(userWallet, signerWallet, fundingWallet)
          })
          .then((result) => {
            Helper.debugLog(result)

            this.displayToast('Success!')
            return null
          })
          .catch((error) => {
            Helper.debugLog(error)
            this.displayToast('Error', true)
          })
          .finally(() => {
            this.loading = false
            StellarUtils.updateBalances()
          })
      }
    },
    displayToast(message, error = false) {
      Helper.toast(message, error)
    }
  }
}
</script>

<style lang='scss' scoped>
@import '../scss/styles.scss';

.main-container {
    display: flex;
    flex-direction: column;
    align-items:: center;

    .user-area {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items:: center;
        background: rgba(0,0,0,.025);
        padding: 10px;
        margin-top: 10px;

        .user-buttons {
            margin-top: 10px;
            button {
                margin: 0 3px;
            }
        }
    }
    .admin-area {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items:: center;
        background: rgba(0,0,0,.05);
        padding: 10px;
        margin: 10px;
    }
}
</style>