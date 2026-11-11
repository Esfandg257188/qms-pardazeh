import React from 'react'
import ReactDOM from 'react-dom/client'
import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { App } from './App'
import './style.css'

const projectId = '82479bc9ba09c0a243dba49a6731849c'

const qmsTestnet = {
  id: 19480,
  caipNetworkId: 'eip155:19480',
  chainNamespace: 'eip155',
  name: 'QMS Testnet',
  nativeCurrency: {
    name: 'QMS',
    symbol: 'QMS',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.qms.finance']
    }
  },
  blockExplorers: {
    default: {
      name: 'QMSScan',
      url: 'https://testnet.qmsscan.io'
    }
  },
  testnet: true
}

createAppKit({
  adapters: [new EthersAdapter()],
  networks: [qmsTestnet],
  defaultNetwork: qmsTestnet,
  projectId,
  metadata: {
    name: 'QMS Testnet DApp',
    description: 'GM and contract deployment on QMS Testnet',
    url: window.location.origin,
    icons: []
  },
  features: {
    analytics: false
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
