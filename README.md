
## An application for payment gateway of ERC-based tokens
 * To support Klaytn compiler version 0.5.6
 * To utilize low-level-calls for dynamic message call via proxy pattern
 * To buy a token with an address that has insufficient balance
 * Dev Stack based on https://rahulsethuram.medium.com/the-new-solidity-dev-stack-buidler-ethers-waffle-typescript-tutorial-f07917de48ae

[Contracts]
====
## Main
* PaymentGateway - This contract act as a proxy to buy a token from an open market contract
    * managerialCall function - Allow owner to send ether to a specific address and call another contract for any purpose
    * without signature function - Allow contract owner to spend contract's ether for buying and sending ERC-based tokens to a specific address
    * with signature function - Allow anyone who has a valid signature signed by the contract owner to spend the contract's ether for buying and sending ERC-based tokens in the open market contract.

## Libraries
* ERC20Broker - Helper to perform a transaction for exchanging and sending ERC20 token
* ERC721Broker - Helper to perform a transaction for buying and sending ERC721 token

## Examples
* ERC20Seller - This contract acts as a token exchange as well as ERC20 implement
* ERC721Seller - This contract acts as a token seller as well as ERC721 implement

## Clone submodules
`git submodule update --init --recursive`

## Install Dependencies
`npm i`

## Compile Contracts
`npm run compile`

## Run Tests
`npm run test`
