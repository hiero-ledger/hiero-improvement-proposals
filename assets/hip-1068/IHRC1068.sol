// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.4.9 <0.9.0;

interface IHRC1068 {
    enum AllowanceScope {
        CRYPTO_TRANSFER,
        GAS_FEE,
        TRANSACTION_FEE,
        TOKEN_CUSTOM_FEE
    }

    /// extensions of HIP 514
    function approve(address owner, address token, address spender, uint256 amount, AllowanceScope allowanceScope) external
        returns (int64 responseCode);
    function approveNFT(address owner, address token, address approved, uint256 serialNumber, AllowanceScope allowanceScope)
        external returns (int64 responseCode);
    function setApprovalForAll(address owner, address token, address operator, bool approved, AllowanceScope allowanceScope)
        external returns (int64 responseCode);

    /// extensions of HIP 906
    function hbarAllowance(address spender, AllowanceScope allowanceScope) external returns (int64 responseCode,
        int256 amount);
    function hbarApprove(address owner, address spender, int256 amount, AllowanceScope allowanceScope) external
        returns (int64 responseCode);
}

interface IHRC1068TokenFacade {
    enum AllowanceScope {
        CRYPTO_TRANSFER,
        GAS_FEE,
        TRANSACTION_FEE,
        TOKEN_CUSTOM_FEE
    }

    /// extensions of HIP 514
    function approve(address spender, uint256 amount, AllowanceScope allowanceScope) external
        returns (int64 responseCode);
    function approveNFT(address approved, uint256 serialNumber, AllowanceScope allowanceScope)
        external returns (int64 responseCode);
    function setApprovalForAll(address operator, bool approved, AllowanceScope allowanceScope)
        external returns (int64 responseCode);
}

interface IHRC1068AccountFacade {
    enum AllowanceScope {
        CRYPTO_TRANSFER,
        GAS_FEE,
        TRANSACTION_FEE,
        TOKEN_CUSTOM_FEE
    }

    /// extensions of HIP 906
    function hbarApprove(int256 amount, AllowanceScope allowanceScope) external
        returns (int64 responseCode);
}