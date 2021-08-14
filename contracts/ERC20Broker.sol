pragma solidity ^0.5.0;

import "hardhat/console.sol";
import "../sub_modules/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "../sub_modules/openzeppelin-contracts/contracts/math/SafeMath.sol";
import "../sub_modules/klaytn-low-level-calls/contracts/MsgCallable.sol";

/// @dev Helper to perform a transaction for exchanging and sending ERC20 token
library ERC20Broker {
    using SafeMath for uint256;

    struct BuyOrder {
        address market;
        uint256 price;
        uint256 pos;
        bytes buyData;
    }

    struct SendOrder {
        address tokenAddress;
        address recipient;
        uint256 amount;
    }

    function process(BuyOrder memory buyOrder, SendOrder memory sendOrder)
        internal
        returns (bool)
    {
        IERC20 ERC20 = IERC20(sendOrder.tokenAddress);
        uint256 initialBalance = ERC20.balanceOf(address(this));

        require(
            buy(
                buyOrder.market,
                buyOrder.price,
                buyOrder.pos,
                buyOrder.buyData
            ),
            "ERC20Broker: buy fail"
        );
        uint256 newBalance = ERC20.balanceOf(address(this));
        require(newBalance > initialBalance, "ERC20Broker: balance error");

        initialBalance = ERC20.balanceOf(sendOrder.recipient);

        ERC20.transfer(sendOrder.recipient, sendOrder.amount);

        newBalance = ERC20.balanceOf(sendOrder.recipient);
        return (initialBalance.add(sendOrder.amount) == newBalance);
    }

    function buy(
        address market,
        uint256 price,
        uint256 pos,
        bytes memory buyData
    ) internal returns (bool) {
        require(market != address(0), "ERC20Broker: wrong market address");

        uint256 callSize = buyData.length;
        return MsgCallable.externalCall(market, price, pos, callSize);
    }
}
