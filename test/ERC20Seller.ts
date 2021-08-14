import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ERC20Seller__factory, ERC20Seller } from "../typechain";

import { getCalldata } from "./shared/utilities";

chai.use(chaiAsPromised);
const { expect } = chai;

describe("ERC20Seller", () => {
  let shop: ERC20Seller;
  let signers: any[];

  beforeEach(async () => {
    signers = await ethers.getSigners();

    const shopFactory = (await ethers.getContractFactory(
      "ERC20Seller",
      signers[0]
    )) as ERC20Seller__factory;
    shop = await shopFactory.deploy("noName", "NN");
    await shop.deployed();

    const initialCount = await shop.totalSupply();
    expect(initialCount).to.eq(0);
    expect(shop.address).to.properAddress;
  });

  describe("exchange fungible token", async () => {
    it("should receive exact token and ether", async () => {
      const seller = signers[0];
      const buyer = signers[1];
      const targetToken = 242; // 1 is to 1 ratio

      const calldata: string = getCalldata(
        "ERC20Seller",
        "exchange",
        [],
        "examples/"
      );
      const initialBalance = await seller.getBalance();
      const initialTokenBalance = await shop.balanceOf(buyer.address);
      expect(initialTokenBalance).to.eq(0);

      await buyer.sendTransaction({
        to: shop.address,
        value: targetToken,
        data: calldata,
      });

      expect(await seller.getBalance()).to.eq(initialBalance.add(targetToken));
      expect(await shop.balanceOf(buyer.address)).to.eq(
        initialTokenBalance.add(targetToken)
      );
    });
  });
});
