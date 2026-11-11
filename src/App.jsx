import React, { useEffect, useState } from 'react'
import {
  BrowserProvider,
  Contract,
  ContractFactory,
  JsonRpcProvider,
  formatEther,
  parseUnits
} from 'ethers'

import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
  useDisconnect
} from '@reown/appkit/react'

import GMArtifact from '../artifacts/GMBoard.json'
import StorageArtifact from '../artifacts/SimpleStorage.json'
import TokenArtifact from '../artifacts/UserCreatedToken.json'
import { GM_CONTRACT_ADDRESS } from './config'

const RPC = 'https://rpc.testnet.qms.finance'
const EXPLORER = 'https://testnet.qmsscan.io'

const readProvider = new JsonRpcProvider(RPC, {
  chainId: 19480,
  name: 'qms-testnet'
})

export function App() {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { chainId } = useAppKitNetwork()
  const { walletProvider } = useAppKitProvider('eip155')
  const { disconnect } = useDisconnect()

  const [balance, setBalance] = useState('—')
  const [txCount, setTxCount] = useState('—')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [txLink, setTxLink] = useState('')
  const [txHash, setTxHash] = useState('')

  const [tokenName, setTokenName] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [tokenSupply, setTokenSupply] = useState('')

  const correctNetwork = Number(chainId) === 19480

  function clearStatus() {
    setMessage('')
    setError('')
    setTxLink('')
    setTxHash('')
  }

  function showSuccess(text, hash) {
    setMessage(text)
    setTxLink(`${EXPLORER}/tx/${hash}`)
    setTxHash(hash)
  }

  async function getSigner() {
    if (!isConnected || !walletProvider) {
      throw new Error('Connect your wallet first.')
    }

    const targetChainId = '0x4c18'

    let currentChainId = await walletProvider.request({
      method: 'eth_chainId'
    })

    if (String(currentChainId).toLowerCase() !== targetChainId) {
      try {
        await walletProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainId }]
        })
      } catch (switchError) {
        if (switchError.code !== 4902) {
          throw new Error('Please switch your wallet to QMS Testnet.')
        }

        await walletProvider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: targetChainId,
            chainName: 'QMS Testnet',
            nativeCurrency: {
              name: 'QMS',
              symbol: 'QMS',
              decimals: 18
            },
            rpcUrls: [RPC],
            blockExplorerUrls: [EXPLORER]
          }]
        })

        await walletProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainId }]
        })
      }
    }

    currentChainId = await walletProvider.request({
      method: 'eth_chainId'
    })

    if (String(currentChainId).toLowerCase() !== targetChainId) {
      throw new Error('Wrong network. Select QMS Testnet.')
    }

    const provider = new BrowserProvider(walletProvider)
    return await provider.getSigner()
  }

  async function refreshWallet() {
    if (!address) return

    setLoading(true)

    try {
      const [rawBalance, count] = await Promise.all([
        readProvider.getBalance(address),
        readProvider.getTransactionCount(address, 'latest')
      ])

      setBalance(
        Number(formatEther(rawBalance)).toLocaleString('en-US', {
          maximumFractionDigits: 5
        })
      )

      setTxCount(String(count))
    } catch {
      setError('Unable to load wallet information.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected && address) {
      refreshWallet()
    } else {
      setBalance('—')
      setTxCount('—')
      clearStatus()
    }
  }, [isConnected, address])

  async function handleGM() {
    setBusy('gm')
    clearStatus()

    try {
      const signer = await getSigner()

      if (!GM_CONTRACT_ADDRESS) {
        throw new Error('GM contract address is not configured.')
      }

      const contract = new Contract(
        GM_CONTRACT_ADDRESS,
        GMArtifact.abi,
        signer
      )

      const tx = await contract.sendGM()
      const receipt = await tx.wait()

      if (!receipt || receipt.status !== 1) {
        throw new Error('GM transaction was not confirmed.')
      }

      showSuccess('GM recorded successfully on QMS Testnet.', tx.hash)
      await refreshWallet()
    } catch (err) {
      setError(err?.shortMessage || err?.reason || err?.message || 'GM failed.')
    } finally {
      setBusy('')
    }
  }

  async function handleDeploy() {
    setBusy('deploy')
    clearStatus()

    try {
      const signer = await getSigner()

      const factory = new ContractFactory(
        StorageArtifact.abi,
        StorageArtifact.bytecode,
        signer
      )

      const contract = await factory.deploy()
      const tx = contract.deploymentTransaction()

      if (!tx) throw new Error('Deployment transaction unavailable.')

      const receipt = await tx.wait()

      if (!receipt || receipt.status !== 1) {
        throw new Error('Contract deployment was not confirmed.')
      }

      showSuccess(
        `SimpleStorage deployed: ${await contract.getAddress()}`,
        tx.hash
      )

      await refreshWallet()
    } catch (err) {
      setError(err?.shortMessage || err?.reason || err?.message || 'Deployment failed.')
    } finally {
      setBusy('')
    }
  }

  async function handleCreateToken(event) {
    event.preventDefault()
    setBusy('token')
    clearStatus()

    try {
      const name = tokenName.trim()
      const symbol = tokenSymbol.trim().toUpperCase()
      const supply = tokenSupply.trim()

      if (!name || !symbol || !supply) {
        throw new Error('Complete all token fields.')
      }

      if (name.length > 64 || symbol.length > 16) {
        throw new Error('Token name or symbol is too long.')
      }

      if (!/^[a-zA-Z0-9]+$/.test(symbol)) {
        throw new Error('Symbol must contain letters and numbers only.')
      }

      if (!/^\d+(\.\d{1,18})?$/.test(supply)) {
        throw new Error('Enter a valid supply with up to 18 decimals.')
      }

      const amount = parseUnits(supply, 18)

      if (amount <= 0n) {
        throw new Error('Supply must be greater than zero.')
      }

      const signer = await getSigner()
      const recipient = await signer.getAddress()

      const factory = new ContractFactory(
        TokenArtifact.abi,
        TokenArtifact.bytecode,
        signer
      )

      const contract = await factory.deploy(
        name,
        symbol,
        amount,
        recipient
      )

      const tx = contract.deploymentTransaction()

      if (!tx) throw new Error('Token deployment transaction unavailable.')

      const receipt = await tx.wait()

      if (!receipt || receipt.status !== 1) {
        throw new Error('Token deployment was not confirmed.')
      }

      const tokenAddress = await contract.getAddress()

      showSuccess(
        `Token ${symbol} created successfully. Contract: ${tokenAddress}`,
        tx.hash
      )

      setTokenName('')
      setTokenSymbol('')
      setTokenSupply('')

      await refreshWallet()
    } catch (err) {
      setError(err?.shortMessage || err?.reason || err?.message || 'Token creation failed.')
    } finally {
      setBusy('')
    }
  }

  async function handleWalletButton() {
    clearStatus()

    if (isConnected) {
      try {
        await disconnect({ namespace: 'eip155' })
      } catch (err) {
        setError(err?.shortMessage || err?.message || 'Unable to disconnect wallet.')
      }
    } else {
      await open({ view: 'Connect' })
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Q</span>
          <span>QMS <b>Pardazeh</b></span>
        </div>

        <button
          className="wallet-button"
          onClick={handleWalletButton}
          title={isConnected ? address : 'Connect Wallet'}
        >
          {isConnected && address
            ? `${address.slice(0, 6)}...${address.slice(-4)}`
            : 'Connect Wallet'}
        </button>
      </header>

      <section className="intro">
        <div className="eyebrow">QMS TESTNET · CHAIN 19480</div>
        <h1>QMS Pardazeh</h1>
        <p>On-chain tools for the QMS ecosystem.</p>
      </section>

      <section className="actions">
        <article className="action-card">
          <div className="card-icon">GM</div>
          <h2>Send GM</h2>
          <p>Record your GM on QMS Testnet.</p>
          <button
            className="primary-button"
            onClick={handleGM}
            disabled={!isConnected || !!busy}
          >
            {busy === 'gm' ? 'Processing...' : 'Send GM'}
          </button>
        </article>

        <article className="action-card">
          <div className="card-icon deploy-icon">↗</div>
          <h2>Deploy Contract</h2>
          <p>Deploy your own SimpleStorage contract.</p>
          <button
            className="primary-button"
            onClick={handleDeploy}
            disabled={!isConnected || !!busy}
          >
            {busy === 'deploy' ? 'Deploying...' : 'Deploy'}
          </button>
        </article>
      </section>

      <section className="wallet-panel">
        <h2>ERC-20 Token Generator</h2>
        <p>Create a fixed-supply token on QMS Testnet.</p>

        <form onSubmit={handleCreateToken}>
          <label>Token Name</label>
          <input
            value={tokenName}
            onChange={e => setTokenName(e.target.value)}
            placeholder="Example: Pardazeh Token"
            maxLength={64}
            required
          />

          <label>Token Symbol</label>
          <input
            value={tokenSymbol}
            onChange={e => setTokenSymbol(e.target.value)}
            placeholder="Example: PRDZ"
            maxLength={16}
            required
          />

          <label>Initial Supply</label>
          <input
            value={tokenSupply}
            onChange={e => setTokenSupply(e.target.value)}
            placeholder="Example: 1000000"
            inputMode="decimal"
            required
          />

          <small>
            18 decimals · Fixed supply · No additional minting · No transfer tax
          </small>

          <button
            className="primary-button"
            type="submit"
            disabled={!isConnected || !!busy}
          >
            {busy === 'token' ? 'Creating Token...' : 'Create ERC-20 Token'}
          </button>
        </form>
      </section>

      {(message || error) && (
        <section className="wallet-panel">
          {message && <p className="connected">{message}</p>}
          {error && <p className="error">{error}</p>}

          {txLink && txHash && (
            <div className="tx-result">
              <div className="tx-result-title">Transaction confirmed</div>
              <div className="tx-hash">{txHash}</div>
              <div className="tx-actions">
                <button
                  type="button"
                  className="copy-button"
                  onClick={() => {
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(txHash)
                    }
                  }}
                >
                  Copy transaction hash
                </button>
                <a
                  className="explorer-link"
                  href={txLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open QMSScan ↗
                </a>
              </div>
              <small>Paste the copied hash into the QMSScan search field.</small>
            </div>
          )}
        </section>
      )}

      <section className="wallet-panel">
        <div className="panel-heading">
          <h2>Wallet Information</h2>
          <button
            className="refresh-button"
            onClick={refreshWallet}
            disabled={!isConnected || loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="info-row">
          <span>Connection</span>
          <b className={isConnected ? 'connected' : ''}>
            {isConnected ? 'Connected' : 'Not connected'}
          </b>
        </div>

        <div className="info-row">
          <span>Network</span>
          <b>
            {isConnected && correctNetwork
              ? 'QMS Testnet'
              : isConnected
                ? 'Wrong network'
                : '—'}
          </b>
        </div>

        <div className="info-row">
          <span>QMS Balance</span>
          <b>{balance} QMS</b>
        </div>

        <div className="info-row">
          <span>Outgoing Transactions (Nonce)</span>
          <b>{txCount}</b>
        </div>

        {isConnected && address && (
          <a
            className="explorer-link"
            href={`${EXPLORER}/address/${address}`}
            target="_blank"
            rel="noreferrer"
          >
            View wallet on QMSScan ↗
          </a>
        )}
      </section>

      <footer>QMS Testnet · Built for on-chain testing</footer>
    </main>
  )
}
