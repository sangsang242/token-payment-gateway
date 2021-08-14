import type { Contract } from 'ethers'
import { BigNumber } from 'ethers'
import {
  Interface,
  keccak256,
  defaultAbiCoder,
  solidityPack
} from 'ethers/lib/utils'

function getDomainSeparator(chainId: number, contractAddress: string): string {
  return keccak256(
    defaultAbiCoder.encode(
      ['uint256', 'address'],
      [
        chainId,
        contractAddress
      ]
    )
  )
}

// return calldata for specific contract
export function getCalldata(
  contractName: string,
  functionName: string,
  argumentArr: any[],
  abiPath?: string
): string {
  let compiled;
  if (abiPath) {
    compiled = require(`../../artifacts/contracts/${abiPath}${contractName}.sol/${contractName}.json`);
  } else {
    compiled = require(`../../artifacts/contracts/${contractName}.sol/${contractName}.json`);
  }
  // web3 style
  // const contract = new web3.Contract(compiled.abi);
  // return contract.methods[functionName](...argumentArr).encodeABI();
  const contract = new Interface(compiled.abi)
  return contract.encodeFunctionData(functionName, argumentArr);
  // return contract.functions[functionName].encode(argumentArr);
}

export function getPosition(
  calldata: string,
  tobeCalldata: string
): number {
  // tobeCalldata is located somewhere in the transaction calldata starts with 0x
  // and this will be used or attached in the future proxy call
  // index indicates where the future proxy call calldata located or started
  // in the initial transaction calldata
  return calldata.indexOf(tobeCalldata.substring(2)) / 2 - 1;
}

// hashing
export async function getDigestFor721(
  chainId: number,
  proxy: Contract,
  nonce: BigNumber | number,
  expiry: BigNumber | number,
  portion: number,
  val: number,
  pos: number,
  tokenId: BigNumber | number,
  dest: string,
  tokenAddress: string,
  recipient: string,
  tobeCalldata: string
): Promise<string> {
  const DOMAIN_SEPARATOR = getDomainSeparator(chainId, proxy.address)
  return keccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        keccak256(
          solidityPack(
            ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256',
            'address', 'address', 'address', 'bytes'],
            [nonce, expiry, portion, val, pos, tokenId,
              dest, tokenAddress, recipient, tobeCalldata]
          )
        )
      ]
    )
  )
}
