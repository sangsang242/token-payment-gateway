pragma solidity ^0.5.0;

import "../../sub_modules/openzeppelin-contracts/contracts/token/ERC721/ERC721Full.sol";

/// @title ERC721Seller
/// @dev This contract acts as token seller as well as ERC721 implement
/// @notice Functions are based on Mintbase smart contract
contract ERC721Seller is ERC721Full {
    uint256 public id;
    address payable public maker;
    address payable feeAddress;

    mapping(uint256 => Price) public items;

    enum TokenState {Pending, ForSale, Sold, Transferred}

    struct Price {
        uint256 tokenId;
        uint256 price;
        string metaId;
        TokenState state;
    }

    event Minted(uint256 id, string metaId);
    event BatchTransfered(string metaId, address[] recipients, uint256[] ids);
    event Bought(uint256 tokenId, string metaId, uint256 value);

    constructor(string memory myName, string memory mySymbol)
        public
        ERC721Full(myName, mySymbol)
    {
        maker = msg.sender;
    }

    function mintThing(
        address to,
        uint256 setPrice,
        string memory metaId
    ) public {
        id = id.add(1);
        items[id].price = setPrice;
        items[id].metaId = metaId;
        items[id].state = TokenState.ForSale;
        _mint(to, id);
        emit Minted(id, metaId);
    }

    function buyThing(uint256 _tokenId) public payable returns (bool) {
        require(msg.value >= items[_tokenId].price, "Price issue");
        require(TokenState.ForSale == items[_tokenId].state, "No Sale");

        maker.transfer(msg.value);

        _transferFrom(maker, msg.sender, _tokenId);
        items[_tokenId].state = TokenState.Sold;

        emit Bought(_tokenId, items[_tokenId].metaId, msg.value);
    }
}
