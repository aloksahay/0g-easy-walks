import { expect } from "chai";
import { ethers } from "hardhat";
import { EasyWalksMarketplace } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("EasyWalksMarketplace", function () {
  let marketplace: EasyWalksMarketplace;
  let owner: HardhatEthersSigner;
  let creatorA: HardhatEthersSigner;
  let creatorB: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;

  const PLATFORM_FEE_BPS = 500; // 5%
  const ROUTE_PRICE = ethers.parseEther("1.0");
  const ROUTE_HASH = ethers.keccak256(ethers.toUtf8Bytes("route-content-hash"));

  beforeEach(async function () {
    [owner, creatorA, creatorB, buyer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("EasyWalksMarketplace");
    marketplace = await Factory.deploy(PLATFORM_FEE_BPS);
    await marketplace.waitForDeployment();
  });

  describe("Deployment", function () {
    it("sets owner and platform fee", async function () {
      expect(await marketplace.owner()).to.equal(owner.address);
      expect(await marketplace.platformFeeBps()).to.equal(PLATFORM_FEE_BPS);
      expect(await marketplace.nextRouteId()).to.equal(1);
    });

    it("rejects fee > 30%", async function () {
      const Factory = await ethers.getContractFactory("EasyWalksMarketplace");
      await expect(Factory.deploy(3001)).to.be.revertedWith("fee too high");
    });
  });

  describe("registerRoute", function () {
    it("registers a route with two creators", async function () {
      const tx = await marketplace.registerRoute(
        [creatorA.address, creatorB.address],
        [6000, 4000], // 60/40 split
        ROUTE_PRICE,
        ROUTE_HASH
      );

      await expect(tx)
        .to.emit(marketplace, "RouteRegistered")
        .withArgs(1, ROUTE_PRICE, 2);

      const route = await marketplace.getRoute(1);
      expect(route.creators).to.deep.equal([creatorA.address, creatorB.address]);
      expect(route.sharesBps.map(Number)).to.deep.equal([6000, 4000]);
      expect(route.priceWei).to.equal(ROUTE_PRICE);
      expect(route.routeHash).to.equal(ROUTE_HASH);
      expect(route.active).to.be.true;

      expect(await marketplace.nextRouteId()).to.equal(2);
    });

    it("registers a route with single creator (10000 bps)", async function () {
      await marketplace.registerRoute(
        [creatorA.address],
        [10000],
        ROUTE_PRICE,
        ROUTE_HASH
      );
      const route = await marketplace.getRoute(1);
      expect(route.creators.length).to.equal(1);
    });

    it("rejects non-owner", async function () {
      await expect(
        marketplace.connect(buyer).registerRoute(
          [creatorA.address],
          [10000],
          ROUTE_PRICE,
          ROUTE_HASH
        )
      ).to.be.revertedWith("only owner");
    });

    it("rejects shares not summing to 10000", async function () {
      await expect(
        marketplace.registerRoute(
          [creatorA.address, creatorB.address],
          [5000, 4000], // sum = 9000
          ROUTE_PRICE,
          ROUTE_HASH
        )
      ).to.be.revertedWith("shares must sum to 10000");
    });

    it("rejects empty creators", async function () {
      await expect(
        marketplace.registerRoute([], [], ROUTE_PRICE, ROUTE_HASH)
      ).to.be.revertedWith("no creators");
    });

    it("rejects zero price", async function () {
      await expect(
        marketplace.registerRoute([creatorA.address], [10000], 0, ROUTE_HASH)
      ).to.be.revertedWith("price must be > 0");
    });

    it("rejects zero address creator", async function () {
      await expect(
        marketplace.registerRoute([ethers.ZeroAddress], [10000], ROUTE_PRICE, ROUTE_HASH)
      ).to.be.revertedWith("zero address");
    });
  });

  describe("purchaseRoute", function () {
    beforeEach(async function () {
      await marketplace.registerRoute(
        [creatorA.address, creatorB.address],
        [6000, 4000],
        ROUTE_PRICE,
        ROUTE_HASH
      );
    });

    it("purchases and splits payment correctly", async function () {
      const tx = await marketplace.connect(buyer).purchaseRoute(1, { value: ROUTE_PRICE });

      await expect(tx)
        .to.emit(marketplace, "RoutePurchased")
        .withArgs(1, buyer.address, ROUTE_PRICE);

      expect(await marketplace.hasPurchased(buyer.address, 1)).to.be.true;

      // 5% platform fee = 0.05 ETH, creator pool = 0.95 ETH
      // Creator A: 60% of 0.95 = 0.57 ETH
      // Creator B: 40% of 0.95 = 0.38 ETH
      const creatorPool = ROUTE_PRICE - (ROUTE_PRICE * BigInt(PLATFORM_FEE_BPS)) / 10000n;
      const expectedA = (creatorPool * 6000n) / 10000n;
      const expectedB = (creatorPool * 4000n) / 10000n;

      expect(await marketplace.creatorBalance(creatorA.address)).to.equal(expectedA);
      expect(await marketplace.creatorBalance(creatorB.address)).to.equal(expectedB);
    });

    it("rejects wrong payment amount", async function () {
      await expect(
        marketplace.connect(buyer).purchaseRoute(1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("wrong payment");
    });

    it("rejects double purchase", async function () {
      await marketplace.connect(buyer).purchaseRoute(1, { value: ROUTE_PRICE });
      await expect(
        marketplace.connect(buyer).purchaseRoute(1, { value: ROUTE_PRICE })
      ).to.be.revertedWith("already purchased");
    });

    it("rejects purchase of inactive route", async function () {
      await marketplace.deactivateRoute(1);
      await expect(
        marketplace.connect(buyer).purchaseRoute(1, { value: ROUTE_PRICE })
      ).to.be.revertedWith("route not active");
    });
  });

  describe("withdrawEarnings", function () {
    beforeEach(async function () {
      await marketplace.registerRoute(
        [creatorA.address],
        [10000],
        ROUTE_PRICE,
        ROUTE_HASH
      );
      await marketplace.connect(buyer).purchaseRoute(1, { value: ROUTE_PRICE });
    });

    it("creator withdraws earnings", async function () {
      const balanceBefore = await ethers.provider.getBalance(creatorA.address);
      const expectedEarnings = ROUTE_PRICE - (ROUTE_PRICE * BigInt(PLATFORM_FEE_BPS)) / 10000n;

      const tx = await marketplace.connect(creatorA).withdrawEarnings();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(creatorA.address);
      expect(balanceAfter).to.equal(balanceBefore + expectedEarnings - gasUsed);
      expect(await marketplace.creatorBalance(creatorA.address)).to.equal(0);
    });

    it("rejects withdrawal with zero balance", async function () {
      await expect(
        marketplace.connect(creatorB).withdrawEarnings()
      ).to.be.revertedWith("no earnings");
    });
  });

  describe("deactivateRoute", function () {
    it("owner can deactivate", async function () {
      await marketplace.registerRoute([creatorA.address], [10000], ROUTE_PRICE, ROUTE_HASH);
      await marketplace.deactivateRoute(1);
      const route = await marketplace.getRoute(1);
      expect(route.active).to.be.false;
    });

    it("non-owner cannot deactivate", async function () {
      await marketplace.registerRoute([creatorA.address], [10000], ROUTE_PRICE, ROUTE_HASH);
      await expect(
        marketplace.connect(buyer).deactivateRoute(1)
      ).to.be.revertedWith("only owner");
    });
  });
});
