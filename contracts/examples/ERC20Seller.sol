pragma solidity ^0.5.0;

import "../../sub_modules/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "../../sub_modules/openzeppelin-contracts/contracts/token/ERC20/ERC20Detailed.sol";

/// @title ERC20Seller
/// @dev This contract acts as a token exchange as well as ERC20 implement
contract ERC20Seller is ERC20, ERC20Detailed {
    address payable public maker;

    event Exchanged(address receiver, uint256 amount);

    constructor(string memory myName, string memory mySymbol)
        public
        ERC20Detailed(myName, mySymbol, 18)
    {
        maker = msg.sender;
    }

    function exchange() public payable returns (bool) {
        require(msg.value > 0, "zero is not allowed");

        maker.transfer(msg.value);

        _mint(msg.sender, msg.value);
        emit Exchanged(msg.sender, msg.value);
        return true;
    }
}
