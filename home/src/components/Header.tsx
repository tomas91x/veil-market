import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-brand">
            <span className="brand-mark">VM</span>
            <div>
              <h1 className="header-title">Veil Market</h1>
              <p className="header-subtitle">Encrypted fZama swaps on Sepolia</p>
            </div>
          </div>
          <div className="header-actions">
            <span className="header-chip">Sepolia</span>
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}
