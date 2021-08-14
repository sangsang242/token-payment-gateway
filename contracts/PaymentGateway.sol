pragma solidity ^0.5.0;

import "hardhat/console.sol";
import "../sub_modules/openzeppelin-contracts/contracts/ownership/Ownable.sol";
import "../sub_modules/openzeppelin-contracts/contracts/lifecycle/Pausable.sol";
import "../sub_modules/klaytn-low-level-calls/contracts/MsgCallable.sol";
import "../sub_modules/klaytn-low-level-calls/contracts/Verifiable.sol";
import "./ERC721Broker.sol";

/// @title PaymentGateway
/// @dev This contract act as a proxy to buy token from open market contract
/// @notice This contract buys token and sends to credit card payer's desired address
contract PaymentGateway is Ownable, Pausable {
    bytes32 public DOMAIN_SEPARATOR;

    mapping(address => mapping(address => uint256)) public paymentIds;

    event CompletedByUser(
        address market,
        address recipient,
        uint256 paymentId,
        address tokenAddress,
        uint256 tokenId
    );

    event CompletedByOwner(
        address market,
        address recipient,
        address tokenAddress,
        uint256 tokenId
    );

    constructor(uint256 chainId) public {
        DOMAIN_SEPARATOR = keccak256(abi.encode(chainId, address(this)));
        pause();
    }

    function() external {
        revert("PaymentGateway: fallback is called");
    }

    function donate() external payable whenNotPaused {
        require(msg.value > 0, "zero ether value");
    }

    /// @dev Call functions dynamically for operational control
    function managerialCall(
        address _dest,
        uint256 _val,
        uint256 _pos,
        bytes calldata _callData
    ) external payable onlyOwner {
        uint256 callSize = _callData.length;
        require(
            MsgCallable.externalCall(_dest, _val, _pos, callSize),
            "PaymentGateway: managerialCall fail"
        );
    }

    /// @dev Buys demanding token on behalf of recipient and transfers it
    /// @param uints[6]
    /** 
        uints[0] paymentId: Unique serial number of the payment per recipient
        uints[1] expiryBlock: Expiry block number
        uints[2] portion: Portion payment if required
        uints[3] price: Price of the token that this contract buy
        uints[4] pos: Starting position of calldata to call another contract from the initial calldata
        uints[5] tokenId: Demanding token's id
    */
    /// @param addrs[3]
    /**
        addrs[0] market: Contract address that sells token
        addrs[1] tokenAddress: Demanding token's contract address
        addrs[2] recipient: Credit card payer's address
    */
    /// @param _buyData Calldata to call another contract
    /// @param _sig Signature which is signed by the owner
    function order721WithSig(
        uint256[6] calldata uints,
        address[3] calldata addrs,
        bytes calldata _buyData,
        bytes calldata _sig
    ) external payable whenNotPaused {
        // console.log for hardhat test
        // console.log("order721WithSig params uints:", uints[0]); //paymentId
        // console.log("order721WithSig params uints:", uints[1]); //expiryBlock
        // console.log("order721WithSig params uints:", uints[2]); //portion
        // console.log("order721WithSig params uints:", uints[3]); //price
        // console.log("order721WithSig params uints:", uints[4]); //pos
        // console.log("order721WithSig params uints:", uints[5]); //tokenId
        // console.log("order721WithSig params address:", addrs[0]); //market
        // console.log("order721WithSig params address:", addrs[1]); //tokenAddress
        // console.log("order721WithSig params address:", addrs[2]); //recipient

        /** signature validation */
        ERC721Broker.BuyOrder memory buyOrder = ERC721Broker.BuyOrder(
            addrs[0],
            uints[3],
            uints[4],
            _buyData
        );
        ERC721Broker.SendOrder memory sendOrder = ERC721Broker.SendOrder(
            addrs[1],
            addrs[2],
            uints[5]
        );
        bytes32 elements = keccak256(
            abi.encodePacked(
                uints[0],
                uints[1],
                uints[2],
                uints[3],
                uints[4],
                uints[5],
                addrs[0],
                addrs[1],
                addrs[2],
                _buyData
            )
        );
        require(
            Verifiable.verify(owner(), DOMAIN_SEPARATOR, elements, _sig),
            "PaymentGateway: verify fail"
        );

        /** data validation */
        uint256 paymentId = uints[0];
        uint256 expiryBlock = uints[1];
        uint256 portion = uints[2];
        require(
            paymentIds[buyOrder.market][sendOrder.recipient] == paymentId,
            "PaymentGateway: wrong payment id"
        );
        require(
            expiryBlock >= block.number,
            "PaymentGateway: PaymentGateway: EXPIRED"
        );
        require(
            portion <= msg.value,
            "PaymentGateway: amount paid is not enough"
        );
        require(
            buyOrder.price <= address(this).balance,
            "PaymentGateway: contract amount is not enough"
        );

        /** execute */
        require(
            ERC721Broker.process(buyOrder, sendOrder),
            "PaymentGateway: process fail"
        );

        emit CompletedByUser(
            buyOrder.market,
            sendOrder.recipient,
            paymentId,
            sendOrder.tokenAddress,
            sendOrder.tokenId
        );
    }

    /// @dev Buys demanding token on behalf of recipient and transfers it
    /// @param _market Contract address that sells token
    /// @param _price Price of the token that this contract buy
    /// @param _pos Starting position of calldata to call another contract from the initial calldata
    /// @param _tokenAddress Demanding token's contract address
    /// @param _recipient Credit card payer's address
    /// @param _tokenId Demanding token's id
    /// @param _buyData Calldata to call another contract
    function order721WithoutSig(
        address _market,
        uint256 _price,
        uint256 _pos,
        address _tokenAddress,
        address _recipient,
        uint256 _tokenId,
        bytes calldata _buyData
    ) external payable onlyOwner {
        require(
            ERC721Broker.process(
                ERC721Broker.BuyOrder(_market, _price, _pos, _buyData),
                ERC721Broker.SendOrder(_tokenAddress, _recipient, _tokenId)
            ),
            "PaymentGateway: process fail"
        );

        emit CompletedByOwner(_market, _recipient, _tokenAddress, _tokenId);
    }
}
