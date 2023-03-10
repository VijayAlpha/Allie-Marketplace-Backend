const fetch = require("node-fetch");
const { Wallet, Chain, Network } = require("mintbase");

const catchAsync = require("./../utils/catchAsync.js");
const AppError = require("./../utils/appError.js");

exports.connectedAccount = catchAsync(async (req, res, next) => {
  // Check the connected wallet User
  console.log(req.body);
  if (req.body.connectedAccount) {
    req.user = req.body.connectedAccount;
    next();
  } else {
    return next(new AppError("UnAuthenticated ", 403));
  }
});

exports.isAdmin = catchAsync(async (req, res, next) => {
  if (process.env.OWNER_WALLET === req.user) {
    next();
  } else {
    return next(new AppError("UnAuthenticated Signer Failed", 403));
  }
});

exports.isNFTOwned = catchAsync(async (req, res, next) => {
  const operations = (walletAddress_, metadata_id_) => {
    return `
    query checkNFT {
      mb_views_nft_tokens(
        distinct_on: metadata_id
        where: {owner: {_eq: "${walletAddress_}"}, _and: {burned_timestamp: {_is_null: true}, metadata_id: {_eq: "${metadata_id_}"}}}
      ) {
        owner
      }
    }
  `;
  };

  async function fetchGraphQL(operationsDoc, operationName, variables) {
    const result = await fetch(
      "https://interop-testnet.hasura.app/v1/graphql",
      {
        method: "POST",
        body: JSON.stringify({
          query: operationsDoc,
          variables: variables,
          operationName: operationName,
        }),
      }
    );

    return await result.json();
  }

  const walletAddress = req.user;

  const metadata_id = req.body.metadata_id;

  console.log("WalletAddress : ", walletAddress, metadata_id);

  function fetchCheckNFT() {
    return fetchGraphQL(operations(walletAddress, metadata_id), "checkNFT", {});
  }

  const { errors, data } = await fetchCheckNFT();

  console.log(data);

  let pass;

  if (data.mb_views_nft_tokens[0]) {
    const owner = data.mb_views_nft_tokens[0].owner;

    if (owner == walletAddress) {
      pass = true;
    }
  } else {
    pass = false;
  }

  console.log("DATA : ", data.mb_views_nft_tokens[0]);

  if (errors && !pass) {
    console.error("ERROR : ", errors);
    return next(new AppError("UnAuthenticated You are not an Admin.", 403));
  }
  // if there is data that means the owner owns that NFT
  if (pass) {
    next();
  }
});
