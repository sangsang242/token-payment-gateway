import { ecsign, toRpcSig, ECDSASignature } from "ethereumjs-util";
import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {
  PaymentGateway__factory,
  PaymentGateway,
  ERC721Seller__factory,
  ERC721Seller,
} from "../typechain";

import { getCalldata, getDigestFor721, getPosition } from "./shared/utilities";

chai.use(chaiAsPromised);
const { expect } = chai;

describe("PaymentGateway", () => {
  const chainId = 31337;

  let proxy: PaymentGateway;
  let shop: ERC721Seller;
  let signers: any[];
  const owner = ethers.Wallet.createRandom().connect(ethers.provider);

  beforeEach(async () => {
    signers = await ethers.getSigners();
    await signers[0].sendTransaction({
      to: owner.address,
      value: "0x56BC75E2D63100000", // 100ETH
    });

    /** PG */
    const counterFactory = (await ethers.getContractFactory(
      "PaymentGateway",
      owner
    )) as PaymentGateway__factory;
    proxy = await counterFactory.deploy(chainId);
    await proxy.deployed();
    expect(proxy.address).to.properAddress;

    const isPaused = await proxy.paused();
    expect(isPaused).to.eq(true);
    const contractOwner = await proxy.owner();
    expect(contractOwner).to.eq(owner.address);

    /** SHOP */
    const shopFactory = (await ethers.getContractFactory(
      "ERC721Seller",
      owner
    )) as ERC721Seller__factory;
    shop = await shopFactory.deploy("noName", "NN");
    await shop.deployed();

    const initialCount = await shop.totalSupply();
    expect(initialCount).to.eq(0);
    expect(shop.address).to.properAddress;
  });

  describe("test managerialCall", async () => {
    it("should send ether to other", async () => {
      await proxy.unpause();

      const receiver = signers[1];
      const initialDeposit: number = 1000;
      const amountToSend: number = 242;

      const calldata: string = getCalldata("PaymentGateway", "donate", []);
      await owner.sendTransaction({
        to: proxy.address,
        value: initialDeposit,
        data: calldata,
      });

      const initialBalance = await receiver.getBalance();
      await proxy.managerialCall(receiver.address, amountToSend, 0, "0x");

      expect(await receiver.getBalance()).to.eq(
        initialBalance.add(amountToSend)
      );
      const contractBalance = await ethers.provider.getBalance(proxy.address);
      expect(initialDeposit).to.eq(contractBalance.add(amountToSend));
    });

    it("should fail when caller is not the owner", async () => {
      const other = signers[1];
      await expect(
        proxy.connect(other).managerialCall(other.address, 0, 0, "0x")
      ).to.be.reverted;
    });
  });

  describe("test order721WithSig", async () => {
    const calldataPos = 388; // manually calculated

    it("should send nft-token to recipient", async () => {
      const buyer = signers[4];
      const tokenPrice: number = 242;

      /** inital preparation */
      await shop.mintThing(owner.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(owner.address, 0);
      const buyData: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );

      const paymentId = await proxy.paymentIds(shop.address, buyer.address);
      const expriy: number = 5 + (await ethers.provider.getBlockNumber());
      const portion = 0;
      let digest: string = await getDigestFor721(
        chainId,
        proxy,
        paymentId,
        expriy,
        portion,
        tokenPrice,
        calldataPos, // manually calculated
        tokenId,
        shop.address,
        shop.address,
        buyer.address,
        buyData
      );
      const signed: ECDSASignature = ecsign(
        Buffer.from(digest.slice(2), "hex"),
        Buffer.from(owner.privateKey.slice(2), "hex")
      );
      const signature: string = toRpcSig(signed.v, signed.r, signed.s);

      let calldata: string = getCalldata("PaymentGateway", "order721WithSig", [
        [paymentId, expriy, portion, tokenPrice, calldataPos, tokenId],
        [shop.address, shop.address, buyer.address],
        buyData,
        signature,
      ]);
      // calldata = getCalldata("PaymentGateway", "order721WithSig", [
      //   [
      //     paymentId,
      //     expriy,
      //     portion,
      //     tokenPrice,
      //     getPosition(calldata, buyData),
      //     tokenId,
      //   ],
      //   [shop.address, shop.address, buyer.address],
      //   buyData,
      //   signature,
      // ]);

      let tokenOwner = await shop.ownerOf(tokenId);
      expect(tokenOwner).to.eq(owner.address);

      await proxy.unpause();
      await buyer.sendTransaction({
        to: proxy.address,
        value: tokenPrice,
        data: calldata,
      });

      tokenOwner = await shop.ownerOf(tokenId);
      expect(tokenOwner).to.eq(buyer.address);
    });

    it("should spend exact ether price", async () => {
      const buyer = signers[4];
      const tokenPrice = 242;

      /** inital preparation */
      await shop.mintThing(owner.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(owner.address, 0);
      const buyData: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );

      const paymentId = await proxy.paymentIds(shop.address, buyer.address);
      const expriy: number = 5 + (await ethers.provider.getBlockNumber());
      const portion = tokenPrice / 2;
      let digest: string = await getDigestFor721(
        chainId,
        proxy,
        paymentId,
        expriy,
        portion,
        tokenPrice,
        calldataPos, // manually calculated
        tokenId,
        shop.address,
        shop.address,
        buyer.address,
        buyData
      );
      const signed: ECDSASignature = ecsign(
        Buffer.from(digest.slice(2), "hex"),
        Buffer.from(owner.privateKey.slice(2), "hex")
      );
      const signature: string = toRpcSig(signed.v, signed.r, signed.s);

      let calldata: string = getCalldata("PaymentGateway", "order721WithSig", [
        [paymentId, expriy, portion, tokenPrice, calldataPos, tokenId],
        [shop.address, shop.address, buyer.address],
        buyData,
        signature,
      ]);

      await proxy.unpause();
      const depositCalldata: string = getCalldata(
        "PaymentGateway",
        "donate",
        []
      );
      await owner.sendTransaction({
        to: proxy.address,
        value: tokenPrice - portion,
        data: depositCalldata,
      });

      const initialBalance = await owner.getBalance();

      await buyer.sendTransaction({
        to: proxy.address,
        value: portion,
        data: calldata,
      });
      expect(await owner.getBalance()).to.eq(initialBalance.add(tokenPrice));

      const tokenOwner = await shop.ownerOf(tokenId);
      expect(tokenOwner).to.eq(buyer.address);
    });

    it("should fail when paused", async () => {
      const buyer = signers[4];
      const tokenPrice: number = 242;

      /** inital preparation */
      await shop.mintThing(owner.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(owner.address, 0);
      const buyData: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );

      const paymentId = await proxy.paymentIds(shop.address, buyer.address);
      const expriy: number = 5 + (await ethers.provider.getBlockNumber());
      const portion = 0;
      let digest: string = await getDigestFor721(
        chainId,
        proxy,
        paymentId,
        expriy,
        portion,
        tokenPrice,
        calldataPos, // manually calculated
        tokenId,
        shop.address,
        shop.address,
        buyer.address,
        buyData
      );
      const signed: ECDSASignature = ecsign(
        Buffer.from(digest.slice(2), "hex"),
        Buffer.from(owner.privateKey.slice(2), "hex")
      );
      const signature: string = toRpcSig(signed.v, signed.r, signed.s);

      let calldata: string = getCalldata("PaymentGateway", "order721WithSig", [
        [paymentId, expriy, portion, tokenPrice, calldataPos, tokenId],
        [shop.address, shop.address, buyer.address],
        buyData,
        signature,
      ]);

      await expect(
        buyer.sendTransaction({
          to: proxy.address,
          value: tokenPrice,
          data: calldata,
        })
      ).to.be.reverted;
    });

    it("should fail when signiture is not signed by owner", async () => {
      const buyer = signers[4];
      const tokenPrice: number = 242;

      /** inital preparation */
      await shop.mintThing(owner.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(owner.address, 0);
      const buyData: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );

      const paymentId = await proxy.paymentIds(shop.address, buyer.address);
      const expriy: number = 5 + (await ethers.provider.getBlockNumber());
      const portion = 0;
      let digest: string = await getDigestFor721(
        chainId,
        proxy,
        paymentId,
        expriy,
        portion,
        tokenPrice,
        calldataPos, // manually calculated
        tokenId,
        shop.address,
        shop.address,
        buyer.address,
        buyData
      );

      const unknown = ethers.Wallet.createRandom();

      const signed: ECDSASignature = ecsign(
        Buffer.from(digest.slice(2), "hex"),
        Buffer.from(unknown.privateKey.slice(2), "hex")
      );
      const signature: string = toRpcSig(signed.v, signed.r, signed.s);

      let calldata: string = getCalldata("PaymentGateway", "order721WithSig", [
        [paymentId, expriy, portion, tokenPrice, calldataPos, tokenId],
        [shop.address, shop.address, buyer.address],
        buyData,
        signature,
      ]);

      await proxy.unpause();

      await expect(
        buyer.sendTransaction({
          to: proxy.address,
          value: tokenPrice,
          data: calldata,
        })
      ).to.be.reverted;
    });

    it("should fail when payment id is not matched", async () => {
      const buyer = signers[4];
      const tokenPrice: number = 242;

      /** inital preparation */
      await shop.mintThing(owner.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(owner.address, 0);
      const buyData: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );

      let paymentId = await proxy.paymentIds(shop.address, buyer.address);
      paymentId = paymentId.add(1);
      const expriy: number = 5 + (await ethers.provider.getBlockNumber());
      const portion = 0;
      let digest: string = await getDigestFor721(
        chainId,
        proxy,
        paymentId,
        expriy,
        portion,
        tokenPrice,
        calldataPos, // manually calculated
        tokenId,
        shop.address,
        shop.address,
        buyer.address,
        buyData
      );
      const signed: ECDSASignature = ecsign(
        Buffer.from(digest.slice(2), "hex"),
        Buffer.from(owner.privateKey.slice(2), "hex")
      );
      const signature: string = toRpcSig(signed.v, signed.r, signed.s);

      let calldata: string = getCalldata("PaymentGateway", "order721WithSig", [
        [paymentId, expriy, portion, tokenPrice, calldataPos, tokenId],
        [shop.address, shop.address, buyer.address],
        buyData,
        signature,
      ]);

      await proxy.unpause();

      await expect(
        buyer.sendTransaction({
          to: proxy.address,
          value: tokenPrice,
          data: calldata,
        })
      ).to.be.reverted;
    });

    it("should fail when block time is expired", async () => {
      const buyer = signers[4];
      const tokenPrice: number = 242;

      /** inital preparation */
      await shop.mintThing(owner.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(owner.address, 0);
      const buyData: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );

      const paymentId = await proxy.paymentIds(shop.address, buyer.address);
      const expriy: number = 0;
      const portion = 0;
      let digest: string = await getDigestFor721(
        chainId,
        proxy,
        paymentId,
        expriy,
        portion,
        tokenPrice,
        calldataPos, // manually calculated
        tokenId,
        shop.address,
        shop.address,
        buyer.address,
        buyData
      );
      const signed: ECDSASignature = ecsign(
        Buffer.from(digest.slice(2), "hex"),
        Buffer.from(owner.privateKey.slice(2), "hex")
      );
      const signature: string = toRpcSig(signed.v, signed.r, signed.s);

      let calldata: string = getCalldata("PaymentGateway", "order721WithSig", [
        [paymentId, expriy, portion, tokenPrice, calldataPos, tokenId],
        [shop.address, shop.address, buyer.address],
        buyData,
        signature,
      ]);

      await proxy.unpause();

      await expect(
        buyer.sendTransaction({
          to: proxy.address,
          value: tokenPrice,
          data: calldata,
        })
      ).to.be.reverted;
    });

    it("should fail when contract does not hold enough ether", async () => {
      const buyer = signers[4];
      const tokenPrice: number = 242;

      /** inital preparation */
      await shop.mintThing(owner.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(owner.address, 0);
      const buyData: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );

      const paymentId = await proxy.paymentIds(shop.address, buyer.address);
      const expriy: number = 5 + (await ethers.provider.getBlockNumber());
      const portion = tokenPrice / 2;
      let digest: string = await getDigestFor721(
        chainId,
        proxy,
        paymentId,
        expriy,
        portion,
        tokenPrice,
        calldataPos, // manually calculated
        tokenId,
        shop.address,
        shop.address,
        buyer.address,
        buyData
      );
      const signed: ECDSASignature = ecsign(
        Buffer.from(digest.slice(2), "hex"),
        Buffer.from(owner.privateKey.slice(2), "hex")
      );
      const signature: string = toRpcSig(signed.v, signed.r, signed.s);

      let calldata: string = getCalldata("PaymentGateway", "order721WithSig", [
        [paymentId, expriy, portion, tokenPrice, calldataPos, tokenId],
        [shop.address, shop.address, buyer.address],
        buyData,
        signature,
      ]);

      await proxy.unpause();
      const depositCalldata: string = getCalldata(
        "PaymentGateway",
        "donate",
        []
      );
      await owner.sendTransaction({
        to: proxy.address,
        value: tokenPrice - portion - 1,
        data: depositCalldata,
      });

      await expect(
        buyer.sendTransaction({
          to: proxy.address,
          value: portion,
          data: calldata,
        })
      ).to.be.reverted;
    });

    it("should fail when portion of ether is not enough", async () => {
      const buyer = signers[4];
      const tokenPrice: number = 242;

      /** inital preparation */
      await shop.mintThing(owner.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(owner.address, 0);
      const buyData: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );

      const paymentId = await proxy.paymentIds(shop.address, buyer.address);
      const expriy: number = 5 + (await ethers.provider.getBlockNumber());
      const portion = tokenPrice / 2;
      let digest: string = await getDigestFor721(
        chainId,
        proxy,
        paymentId,
        expriy,
        portion,
        tokenPrice,
        calldataPos, // manually calculated
        tokenId,
        shop.address,
        shop.address,
        buyer.address,
        buyData
      );
      const signed: ECDSASignature = ecsign(
        Buffer.from(digest.slice(2), "hex"),
        Buffer.from(owner.privateKey.slice(2), "hex")
      );
      const signature: string = toRpcSig(signed.v, signed.r, signed.s);

      let calldata: string = getCalldata("PaymentGateway", "order721WithSig", [
        [paymentId, expriy, portion, tokenPrice, calldataPos, tokenId],
        [shop.address, shop.address, buyer.address],
        buyData,
        signature,
      ]);

      await proxy.unpause();
      const depositCalldata: string = getCalldata(
        "PaymentGateway",
        "donate",
        []
      );
      await owner.sendTransaction({
        to: proxy.address,
        value: tokenPrice - portion,
        data: depositCalldata,
      });

      await expect(
        buyer.sendTransaction({
          to: proxy.address,
          value: portion - 1,
          data: calldata,
        })
      ).to.be.reverted;
    });
  });

  describe("test order721WithoutSig", async () => {
    const calldataPos = 260; // manually calculated

    it("should send nft-token to recipient", async () => {
      const receiver = signers[4];
      const tokenPrice = 242;

      /** inital preparation */
      await shop.mintThing(owner.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(owner.address, 0);
      const proxyCalldata: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );
      let calldata: string = getCalldata(
        "PaymentGateway",
        "order721WithoutSig",
        [
          shop.address,
          tokenPrice,
          calldataPos,
          shop.address,
          receiver.address,
          tokenId,
          proxyCalldata,
        ]
      );
      // calldata = getCalldata("PaymentGateway", "order721WithoutSig", [
      //   shop.address,
      //   tokenPrice,
      //   getPosition(calldata, proxyCalldata),
      //   shop.address,
      //   receiver.address,
      //   tokenId,
      //   proxyCalldata,
      // ]);

      let tokenOwner = await shop.ownerOf(tokenId);
      expect(tokenOwner).to.eq(owner.address);

      await owner.sendTransaction({
        to: proxy.address,
        value: tokenPrice,
        data: calldata,
      });

      tokenOwner = await shop.ownerOf(tokenId);
      expect(tokenOwner).to.eq(receiver.address);
    });

    it("should send nft-token to recipient without ether", async () => {
      const receiver = signers[4];
      const tokenPrice = 242;

      /** inital preparation */
      await shop.mintThing(owner.address, tokenPrice, "/empty-meta");
      await proxy.unpause();
      const depositCalldata: string = getCalldata(
        "PaymentGateway",
        "donate",
        []
      );
      await owner.sendTransaction({
        to: proxy.address,
        value: tokenPrice,
        data: depositCalldata,
      });

      const tokenId = await shop.tokenOfOwnerByIndex(owner.address, 0);
      const proxyCalldata: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );

      let tokenOwner = await shop.ownerOf(tokenId);
      expect(tokenOwner).to.eq(owner.address);

      await proxy.order721WithoutSig(
        shop.address,
        tokenPrice,
        calldataPos, // manually calculated
        shop.address,
        receiver.address,
        tokenId,
        proxyCalldata
      );

      tokenOwner = await shop.ownerOf(tokenId);
      expect(tokenOwner).to.eq(receiver.address);
    });

    it("should fail when contract does not hold enough ether", async () => {
      const receiver = signers[4];
      const tokenPrice = 242;

      /** inital preparation */
      await shop.mintThing(owner.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(owner.address, 0);
      const proxyCalldata: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );
      let calldata: string = getCalldata(
        "PaymentGateway",
        "order721WithoutSig",
        [
          shop.address,
          tokenPrice,
          calldataPos, // manually calculated
          shop.address,
          receiver.address,
          tokenId,
          proxyCalldata,
        ]
      );

      await expect(
        owner.sendTransaction({
          to: proxy.address,
          value: tokenPrice - 1,
          data: calldata,
        })
      ).to.be.reverted;
    });

    it("should fail when caller is not the owner", async () => {
      const receiver = signers[4];
      const tokenPrice = 242;

      /** inital preparation */
      await shop.mintThing(owner.address, tokenPrice, "/empty-meta");
      const tokenId = await shop.tokenOfOwnerByIndex(owner.address, 0);
      const proxyCalldata: string = getCalldata(
        "ERC721Seller",
        "buyThing",
        [tokenId],
        "examples/"
      );
      let calldata: string = getCalldata(
        "PaymentGateway",
        "order721WithoutSig",
        [
          shop.address,
          tokenPrice,
          calldataPos, // manually calculated
          shop.address,
          receiver.address,
          tokenId,
          proxyCalldata,
        ]
      );

      await expect(
        receiver.sendTransaction({
          to: proxy.address,
          value: tokenPrice,
          data: calldata,
        })
      ).to.be.reverted;
    });
  });
});
