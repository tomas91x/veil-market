// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title fZama Swap
/// @notice Swap ETH for encrypted fZama balances at a fixed rate.
contract FZamaSwap is ZamaEthereumConfig {
    uint256 public constant RATE = 800;
    uint8 public constant DECIMALS = 18;

    mapping(address => euint128) private _balances;

    event SwapExecuted(address indexed buyer, uint256 ethIn, uint256 fZamaOut);

    /// @notice Swap ETH for fZama at a fixed rate (1 ETH = 800 fZama).
    function swap() external payable {
        require(msg.value > 0, "No ETH sent");

        uint256 fZamaOut = msg.value * RATE;
        require(fZamaOut <= type(uint128).max, "Swap amount too large");

        euint128 encryptedAmount = FHE.asEuint128(uint128(fZamaOut));
        euint128 newBalance = FHE.add(_balances[msg.sender], encryptedAmount);
        _balances[msg.sender] = newBalance;

        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);

        emit SwapExecuted(msg.sender, msg.value, fZamaOut);
    }

    /// @notice Returns the encrypted fZama balance for an account.
    /// @param account The account to query.
    function balanceOf(address account) external view returns (euint128) {
        return _balances[account];
    }

    /// @notice Returns the fZama output for a given ETH amount.
    /// @param ethAmount The input ETH amount (wei).
    function previewSwap(uint256 ethAmount) external pure returns (uint256) {
        return ethAmount * RATE;
    }
}
