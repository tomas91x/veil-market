import { useEffect, useMemo, useState } from 'react';
import { Contract, formatUnits, parseEther } from 'ethers';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { useAccount, useChainId } from 'wagmi';
import { Header } from './Header';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import {
  CHAIN_ID,
  FZAMA_DECIMALS,
  FZAMA_RATE,
  RPC_URL,
  SWAP_CONTRACT_ABI,
  SWAP_CONTRACT_ADDRESS,
} from '../config/contracts';
import '../styles/SwapApp.css';

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

const formatHandle = (handle: string) => {
  if (handle.length < 16) {
    return handle;
  }
  return `${handle.slice(0, 10)}...${handle.slice(-6)}`;
};

export function SwapApp() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const signer = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [ethAmount, setEthAmount] = useState('0.1');
  const [encryptedBalance, setEncryptedBalance] = useState<string | null>(null);
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const isWrongNetwork = isConnected && chainId !== CHAIN_ID;
  const isContractConfigured = SWAP_CONTRACT_ADDRESS !== ZERO_HASH;

  const parsedEthAmount = useMemo(() => {
    try {
      return parseEther(ethAmount);
    } catch {
      return null;
    }
  }, [ethAmount]);

  const previewAmount = useMemo(() => {
    if (!parsedEthAmount || parsedEthAmount <= 0n) {
      return '--';
    }
    const fZamaAmount = parsedEthAmount * BigInt(FZAMA_RATE);
    return formatUnits(fZamaAmount, FZAMA_DECIMALS);
  }, [parsedEthAmount]);

  const fetchEncryptedBalance = async () => {
    if (!address || !isContractConfigured) {
      setEncryptedBalance(null);
      setDecryptedBalance(null);
      return;
    }

    try {
      setDecryptedBalance(null);
      const balance = await publicClient.readContract({
        address: SWAP_CONTRACT_ADDRESS,
        abi: SWAP_CONTRACT_ABI,
        functionName: 'balanceOf',
        args: [address],
      });
      setEncryptedBalance(balance as string);
    } catch (error) {
      console.error('Failed to read encrypted balance:', error);
    }
  };

  const handleSwap = async () => {
    setSwapError(null);
    setTxHash(null);

    if (!isConnected || !address) {
      setSwapError('Connect your wallet to swap.');
      return;
    }

    if (isWrongNetwork) {
      setSwapError('Switch to Sepolia to continue.');
      return;
    }

    if (!isContractConfigured) {
      setSwapError('Contract address is not configured yet.');
      return;
    }

    if (!parsedEthAmount || parsedEthAmount <= 0n) {
      setSwapError('Enter a valid ETH amount.');
      return;
    }

    try {
      setIsSwapping(true);
      const resolvedSigner = await signer;
      if (!resolvedSigner) {
        throw new Error('Signer not available');
      }

      const swapContract = new Contract(SWAP_CONTRACT_ADDRESS, SWAP_CONTRACT_ABI, resolvedSigner);
      const tx = await swapContract.swap({ value: parsedEthAmount });
      setTxHash(tx.hash);
      await tx.wait();
      setRefreshIndex((current) => current + 1);
      setDecryptedBalance(null);
    } catch (error) {
      console.error('Swap failed:', error);
      setSwapError(error instanceof Error ? error.message : 'Swap failed.');
    } finally {
      setIsSwapping(false);
    }
  };

  const handleDecrypt = async () => {
    setDecryptError(null);

    if (!instance || !address || !signer) {
      setDecryptError('Connect your wallet to decrypt.');
      return;
    }

    if (!isContractConfigured) {
      setDecryptError('Contract address is not configured yet.');
      return;
    }

    if (!encryptedBalance) {
      setDecryptError('No encrypted balance found.');
      return;
    }

    if (encryptedBalance === ZERO_HASH) {
      setDecryptedBalance('0');
      return;
    }

    try {
      setIsDecrypting(true);
      const resolvedSigner = await signer;
      if (!resolvedSigner) {
        throw new Error('Signer not available');
      }

      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: encryptedBalance,
          contractAddress: SWAP_CONTRACT_ADDRESS,
        },
      ];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [SWAP_CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays,
      );

      const signature = await resolvedSigner.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const rawValue = result[encryptedBalance] ?? 0n;
      const normalized = typeof rawValue === 'bigint' ? rawValue : BigInt(rawValue);
      setDecryptedBalance(formatUnits(normalized, FZAMA_DECIMALS));
    } catch (error) {
      console.error('Decrypt failed:', error);
      setDecryptError(error instanceof Error ? error.message : 'Decryption failed.');
    } finally {
      setIsDecrypting(false);
    }
  };

  useEffect(() => {
    fetchEncryptedBalance();
  }, [address, refreshIndex, isContractConfigured]);

  return (
    <div className="swap-app">
      <div className="ambient-shape shape-one" />
      <div className="ambient-shape shape-two" />
      <Header />

      <main className="swap-main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Private liquidity, public confidence.</p>
            <h2>
              Swap ETH into <span>fZama</span> with balances kept encrypted end-to-end.
            </h2>
            <p className="hero-body">
              The swap rate is fixed and the balances stay hidden on-chain. You decide when to
              decrypt for a clear view.
            </p>

            <div className="hero-stats">
              <div className="stat-card">
                <span>Rate</span>
                <strong>1 ETH = {FZAMA_RATE} fZama</strong>
              </div>
              <div className="stat-card">
                <span>Network</span>
                <strong>Sepolia + Zama Relayer</strong>
              </div>
            </div>
          </div>

          <div className="swap-card">
            <div className="swap-card-header">
              <div>
                <h3>Swap to fZama</h3>
                <p>Encrypted minting at a fixed rate.</p>
              </div>
              <span className={`network-pill ${isWrongNetwork ? 'warning' : ''}`}>
                {isWrongNetwork ? 'Wrong network' : 'Sepolia ready'}
              </span>
            </div>

            <label className="input-label" htmlFor="ethAmount">ETH amount</label>
            <div className="input-row">
              <input
                id="ethAmount"
                type="text"
                inputMode="decimal"
                value={ethAmount}
                onChange={(event) => setEthAmount(event.target.value)}
                placeholder="0.0"
              />
              <span className="input-suffix">ETH</span>
            </div>

            <div className="swap-preview">
              <div>
                <span className="preview-label">Estimated output</span>
                <p className="preview-value">{previewAmount} fZama</p>
              </div>
              <div className="preview-meta">
                <span>Encrypted balance ready</span>
              </div>
            </div>

            {swapError && <p className="error-text">{swapError}</p>}
            {!isContractConfigured && (
              <p className="warning-text">Contract address not configured yet.</p>
            )}

            <button
              className="primary-button"
              onClick={handleSwap}
              disabled={isSwapping || !isContractConfigured}
            >
              {isSwapping ? 'Swapping...' : 'Swap ETH'}
            </button>

            {txHash && (
              <p className="tx-hash">Tx: {formatHandle(txHash)}</p>
            )}
          </div>
        </section>

        <section className="balances">
          <div className="balance-card">
            <div className="balance-header">
              <h4>Encrypted fZama balance</h4>
              <span className="status-chip">{isConnected ? 'Live' : 'Wallet disconnected'}</span>
            </div>
            <div className="balance-body">
              <p className="balance-value">
                {encryptedBalance ? formatHandle(encryptedBalance) : 'Connect wallet to view.'}
              </p>
              <p className="balance-caption">
                This is a ciphertext handle stored on-chain. It does not reveal the amount.
              </p>
            </div>
          </div>

          <div className="balance-card highlight">
            <div className="balance-header">
              <h4>Decrypt for your clear balance</h4>
              <span className="status-chip">{zamaLoading ? 'Relayer loading' : 'Relayer ready'}</span>
            </div>
            <div className="balance-body">
              <p className="balance-value">
                {decryptedBalance !== null ? `${decryptedBalance} fZama` : 'Hidden'}
              </p>
              <p className="balance-caption">
                Decrypt with your wallet signature. Only you can see the clear value.
              </p>
              {zamaError && <p className="error-text">{zamaError}</p>}
              {decryptError && <p className="error-text">{decryptError}</p>}
              <button
                className="ghost-button"
                onClick={handleDecrypt}
                disabled={isDecrypting || !isConnected || zamaLoading}
              >
                {isDecrypting ? 'Decrypting...' : 'Decrypt balance'}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
