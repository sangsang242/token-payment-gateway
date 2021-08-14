import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ERC721Seller__factory, ERC721Seller } from "../typechain";

import { getCalldata } from "./shared/utilities";

chai.use(chaiAsPromised);
const { expect } = chai;

describe("ERC721Seller", () => {
  let shop: ERC721Seller;
  let signers: any[];

  beforeEach(async () => {
    signers = await ethers.getSigners();

    const shopFactory = (await ethers.getContractFactory(
      "ERC721Seller",
      signers[0]
    )) as ERC721Seller__factory;
    shop = await shopFactory.deploy("noName", "NN");
    await shop.deployed();

    const initialCount = await shop.totalSupply();
    expect(initialCount).to.eq(0);
    expect(shop.address).to.properAddress;
  });

  describe("mind nft token", async () => {
    it("should have a proper owner", async () => {
      const owner = signers[0];

      let tokenCount = await shop.balanceOf(owner.address);
      expect(tokenCount).to.eq(0);

      await shop.mintThing(owner.address, 777, "/empty-meta");

      tokenCount = await shop.balanceOf(owner.address);
      expect(tokenCount).to.eq(1);
    });
  });

  describe("transfer nft token", async () => {
    it("should transfer ownership", async () => {
      const sender = signers[0];
      const receiver = signers[1];

      await shop.mintThing(sender.address, 777, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(sender.address, 0);

      let tokenOwner = await shop.ownerOf(tokenId);
      expect(tokenOwner).to.eq(sender.address);

      await shop.transferFrom(sender.address, receiver.address, tokenId);
      tokenOwner = await shop.ownerOf(tokenId);
      expect(tokenOwner).to.eq(receiver.address);
    });
  });

  describe("buy nft token", async () => {
    it("should transfer ownership to buyer", async () => {
      const seller = signers[0];
      const buyer = signers[1];
      const tokenPrice = 0;

      await shop.mintThing(seller.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(seller.address, 0);

      let tokenOwner = await shop.ownerOf(tokenId);
      expect(tokenOwner).to.eq(seller.address);

      await shop.connect(buyer).buyThing(tokenId);
      tokenOwner = await shop.ownerOf(tokenId);
      expect(tokenOwner).to.eq(buyer.address);
    });

    it("should send ether to seller", async () => {
      const seller = signers[0];
      const buyer = signers[1];
      const tokenPrice = 242;

      await shop.mintThing(seller.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(seller.address, 0);

      const calldata: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );

      const initialBalance = await seller.getBalance();
      await buyer.sendTransaction({
        to: shop.address,
        value: tokenPrice,
        data: calldata,
      });
      expect(await seller.getBalance()).to.eq(initialBalance.add(tokenPrice));
    });

    it("should fail when ether amount is below its price", async () => {
      const seller = signers[0];
      const buyer = signers[1];
      const tokenPrice: number = 242;

      await shop.mintThing(seller.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(seller.address, 0);

      const calldata: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );

      await expect(
        buyer.sendTransaction({
          to: shop.address,
          value: tokenPrice - 1, // not enough money is sending
          data: calldata,
        })
      ).to.be.reverted;
    });
  });
});
