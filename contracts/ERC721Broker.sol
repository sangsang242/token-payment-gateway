pragma solidity ^0.5.0;

import "hardhat/console.sol";
import "../sub_modules/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import "../sub_modules/klaytn-low-level-calls/contracts/MsgCallable.sol";

/// @dev Helper to perform a transaction for buying and sending ERC721 token
library ERC721Broker {
    /// @param market address to call
    /// @param price ether amount
    /// @param pos starting position of calldata to send in the initial calldata
    /// @param buyData size of calldata
    struct BuyOrder {
        address market;
        uint256 price;
        uint256 pos;
        bytes buyData;
    }

    /// @param tokenAddress ERC721 token address
    /// @param recipient token receiver
    /// @param tokenId ERC721 token id
    struct SendOrder {
        address tokenAddress;
        address recipient;
        uint256 tokenId;
    }

    function process(BuyOrder memory buyOrder, SendOrder memory sendOrder)
        internal
        returns (bool)
    {
        require(
            buy(
                buyOrder.market,
                buyOrder.price,
                buyOrder.pos,
                buyOrder.buyData
            ),
            "ERC721Broker: buy fail"
        );
        require(
            send(
                sendOrder.tokenAddress,
                sendOrder.recipient,
                sendOrder.tokenId
            ),
            "ERC721Broker: send fail"
        );

        return true;
    }

    function buy(
        address market,
        uint256 price,
        uint256 pos,
        bytes memory buyData
    ) internal returns (bool) {
        require(market != address(0), "ERC721Broker: wrong market address");

        uint256 callSize = buyData.length;
        return MsgCallable.externalCall(market, price, pos, callSize);
    }

    function send(
        address tokenAddress,
        address recipient,
        uint256 tokenId
    ) internal returns (bool) {
        IERC721 ERC721 = IERC721(tokenAddress);
        require(
            isOwner(ERC721, tokenId, address(this)),
            "ERC721Broker: ownership is not transferred"
        );

        ERC721.transferFrom(address(this), recipient, tokenId);
        return isOwner(ERC721, tokenId, recipient);
    }

    function isOwner(
        IERC721 ERC721,
        uint256 tokenId,
        address target
    ) public view returns (bool) {
        address owner = ERC721.ownerOf(tokenId);
        return owner == target ? true : false;
    }
}
