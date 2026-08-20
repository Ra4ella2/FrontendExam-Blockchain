import { useEffect, useState } from "react";
import { ethers } from "ethers";

import MyNFT from "./contracts/MyNFT.json";
import Marketplace from "./contracts/NFTMarketplace.json";

import {
  NFT_ADDRESS,
  MARKETPLACE_ADDRESS
} from "./config";

import "./App.css";


type Page =
  | "marketplace"
  | "my-nfts"
  | "create";


type NFTMetadata = {
  name: string;
  description: string;
  image: string;
};


type NFTItem = {
  tokenId: bigint;
  owner: string;

  name: string;
  description: string;
  image: string;

  uri: string;

  listed: boolean;
  price?: bigint;
};


type Listing = {
  nftContract: string;
  tokenId: bigint;
  seller: string;
  price: bigint;
  active: boolean;

  name: string;
  description: string;
  image: string;
};


function App() {
  const [account, setAccount] =
    useState<string>("");

  const [page, setPage] =
    useState<Page>("marketplace");

  const [status, setStatus] =
    useState<string>("");


  // CREATE NFT

  const [mintName, setMintName] =
    useState<string>("");

  const [mintImage, setMintImage] =
    useState<string>("");

  const [
    mintDescription,
    setMintDescription
  ] = useState<string>("");


  // NFT DATA

  const [myNFTs, setMyNFTs] =
    useState<NFTItem[]>([]);

  const [listings, setListings] =
    useState<Listing[]>([]);

  const [prices, setPrices] =
    useState<Record<string, string>>({});


  // ----------------------------
  // METADATA
  // ----------------------------

  function createMetadataURI(
    name: string,
    description: string,
    image: string
  ): string {
    const metadata: NFTMetadata = {
      name,
      description,
      image
    };

    const json =
      JSON.stringify(metadata);

    const bytes =
      new TextEncoder().encode(json);

    let binary = "";

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    const base64 =
      btoa(binary);

    return (
      "data:application/json;base64," +
      base64
    );
  }


  function readMetadataURI(
    uri: string
  ): NFTMetadata {
    try {
      // Старые NFT:
      // tokenURI содержит сразу картинку
      if (
        !uri.startsWith(
          "data:application/json;base64,"
        )
      ) {
        return {
          name: "NFT",
          description: "",
          image: uri
        };
      }

      const encoded =
        uri.split(",")[1];

      const binary =
        atob(encoded);

      const bytes =
        Uint8Array.from(
          binary,
          (char) => char.charCodeAt(0)
        );

      const json =
        new TextDecoder().decode(bytes);

      const metadata =
        JSON.parse(json);

      return {
        name:
          metadata.name || "NFT",

        description:
          metadata.description || "",

        image:
          metadata.image || ""
      };
    } catch (error) {
      console.error(
        "Metadata read error:",
        error
      );

      return {
        name: "NFT",
        description: "",
        image: ""
      };
    }
  }


  // ----------------------------
  // WALLET
  // ----------------------------

  async function connectWallet():
    Promise<void> {
    try {
      if (!window.ethereum) {
        setStatus(
          "MetaMask не установлен"
        );

        return;
      }

      const provider =
        new ethers.BrowserProvider(
          window.ethereum
        );

      await provider.send(
        "eth_requestAccounts",
        []
      );

      const network =
        await provider.getNetwork();

      if (
        network.chainId !== 31337n
      ) {
        setStatus(
          "Переключи MetaMask на сеть Anvil"
        );

        return;
      }

      const signer =
        await provider.getSigner();

      const address =
        await signer.getAddress();

      setAccount(address);

      setStatus(
        "MetaMask подключен"
      );
    } catch (error) {
      console.error(error);

      setStatus(
        "Ошибка подключения MetaMask"
      );
    }
  }


  async function getSigner() {
    if (!window.ethereum) {
      throw new Error(
        "MetaMask не установлен"
      );
    }

    const provider =
      new ethers.BrowserProvider(
        window.ethereum
      );

    return provider.getSigner();
  }


  async function getNFTContract() {
    const signer =
      await getSigner();

    return new ethers.Contract(
      NFT_ADDRESS,
      MyNFT.abi,
      signer
    );
  }


  async function getMarketplaceContract() {
    const signer =
      await getSigner();

    return new ethers.Contract(
      MARKETPLACE_ADDRESS,
      Marketplace.abi,
      signer
    );
  }


  // ----------------------------
  // MINT
  // ----------------------------

  async function mintNFT():
    Promise<void> {
    try {
      if (!account) {
        setStatus(
          "Сначала подключи MetaMask"
        );

        return;
      }

      if (
        !mintName ||
        !mintImage
      ) {
        setStatus(
          "Заполни название и ссылку на изображение"
        );

        return;
      }

      const metadataURI =
        createMetadataURI(
          mintName,
          mintDescription,
          mintImage
        );

      setStatus(
        "Подтверди Mint в MetaMask..."
      );

      const nft =
        await getNFTContract();

      const tx =
        await nft.mint(
          metadataURI
        );

      setStatus(
        "Транзакция отправлена..."
      );

      await tx.wait();

      setMintName("");
      setMintImage("");
      setMintDescription("");

      setStatus(
        "NFT успешно создан"
      );

      await loadMyNFTs();
    } catch (error) {
      console.error(error);

      setStatus(
        "Ошибка создания NFT"
      );
    }
  }


  // ----------------------------
  // MY NFTs
  // ----------------------------

  async function loadMyNFTs():
    Promise<void> {
    try {
      if (!account) {
        return;
      }

      const nft =
        await getNFTContract();

      const marketplace =
        await getMarketplaceContract();

      const tokenIds: bigint[] =
        await nft.getAllTokenIds();

      const result: NFTItem[] = [];


      for (
        const tokenId of tokenIds
      ) {
        const owner: string =
          await nft.ownerOf(
            tokenId
          );

        if (
          owner.toLowerCase() !==
          account.toLowerCase()
        ) {
          continue;
        }


        const uri: string =
          await nft.tokenURI(
            tokenId
          );


        const metadata =
          readMetadataURI(uri);


        const listed: boolean =
          await marketplace.isListed(
            NFT_ADDRESS,
            tokenId
          );


        let price:
          bigint | undefined;


        if (listed) {
          const listing =
            await marketplace.getListing(
              NFT_ADDRESS,
              tokenId
            );

          price =
            listing.price;
        }


        result.push({
          tokenId,
          owner,

          name: metadata.name,
          description:
            metadata.description,
          image:
            metadata.image,

          uri,

          listed,
          price
        });
      }


      setMyNFTs(result);
    } catch (error) {
      console.error(error);

      setStatus(
        "Ошибка загрузки NFT"
      );
    }
  }


  // ----------------------------
  // MARKETPLACE
  // ----------------------------

  async function loadListings():
    Promise<void> {
    try {
      const marketplace =
        await getMarketplaceContract();

      const nft =
        await getNFTContract();

      const result =
        await marketplace
          .getActiveListings();


      const listingsWithMetadata:
        Listing[] = [];


      for (
        const listing of result
      ) {
        const uri: string =
          await nft.tokenURI(
            listing.tokenId
          );

        const metadata =
          readMetadataURI(uri);


        listingsWithMetadata.push({
          nftContract:
            listing.nftContract,

          tokenId:
            listing.tokenId,

          seller:
            listing.seller,

          price:
            listing.price,

          active:
            listing.active,

          name:
            metadata.name,

          description:
            metadata.description,

          image:
            metadata.image
        });
      }


      setListings(
        listingsWithMetadata
      );
    } catch (error) {
      console.error(error);

      setStatus(
        "Ошибка загрузки Marketplace"
      );
    }
  }


  // ----------------------------
  // APPROVE + LIST
  // ----------------------------

  async function approveAndList(
    tokenId: bigint
  ): Promise<void> {
    try {
      const price =
        prices[
          tokenId.toString()
        ];

      if (!price) {
        setStatus(
          "Укажи цену NFT"
        );

        return;
      }


      const nft =
        await getNFTContract();

      const marketplace =
        await getMarketplaceContract();


      setStatus(
        "Подтверди Approve в MetaMask..."
      );


      const approveTx =
        await nft.approve(
          MARKETPLACE_ADDRESS,
          tokenId
        );

      await approveTx.wait();


      setStatus(
        "Approve готов. Подтверди Listing..."
      );


      const priceWei =
        ethers.parseEther(
          price
        );


      const listTx =
        await marketplace.listNFT(
          NFT_ADDRESS,
          tokenId,
          priceWei
        );

      await listTx.wait();


      setStatus(
        "NFT выставлен на продажу"
      );


      await loadMyNFTs();
      await loadListings();
    } catch (error) {
      console.error(error);

      setStatus(
        "Ошибка выставления NFT"
      );
    }
  }


  // ----------------------------
  // CANCEL
  // ----------------------------

  async function cancelListing(
    tokenId: bigint
  ): Promise<void> {
    try {
      const marketplace =
        await getMarketplaceContract();


      setStatus(
        "Подтверди отмену в MetaMask..."
      );


      const tx =
        await marketplace
          .cancelListing(
            NFT_ADDRESS,
            tokenId
          );

      await tx.wait();


      setStatus(
        "Продажа отменена"
      );


      await loadMyNFTs();
      await loadListings();
    } catch (error) {
      console.error(error);

      setStatus(
        "Ошибка отмены продажи"
      );
    }
  }


  // ----------------------------
  // BUY
  // ----------------------------

  async function buyNFT(
    listing: Listing
  ): Promise<void> {
    try {
      if (
        listing.seller
          .toLowerCase() ===
        account.toLowerCase()
      ) {
        setStatus(
          "Нельзя купить собственный NFT"
        );

        return;
      }


      const marketplace =
        await getMarketplaceContract();


      setStatus(
        "Подтверди покупку в MetaMask..."
      );


      const tx =
        await marketplace.buyNFT(
          listing.nftContract,
          listing.tokenId,
          {
            value:
              listing.price
          }
        );

      await tx.wait();


      setStatus(
        "NFT успешно куплен"
      );


      await loadListings();
      await loadMyNFTs();
    } catch (error) {
      console.error(error);

      setStatus(
        "Ошибка покупки NFT"
      );
    }
  }


  // ----------------------------
  // ACCOUNT CHANGE
  // ----------------------------

  useEffect(() => {
    if (!window.ethereum) {
      return;
    }

    const ethereum =
      window.ethereum as any;


    const handleAccountsChanged =
      (accounts: string[]) => {
        if (
          accounts.length === 0
        ) {
          setAccount("");

          return;
        }

        setAccount(
          accounts[0]
        );
      };


    ethereum.on(
      "accountsChanged",
      handleAccountsChanged
    );


    return () => {
      ethereum.removeListener(
        "accountsChanged",
        handleAccountsChanged
      );
    };
  }, []);


  useEffect(() => {
    if (!account) {
      return;
    }

    loadMyNFTs();
    loadListings();
  }, [account]);


  useEffect(() => {
    if (!account) {
      return;
    }

    if (
      page === "marketplace"
    ) {
      loadListings();
    }

    if (
      page === "my-nfts"
    ) {
      loadMyNFTs();
    }
  }, [page]);


  // ----------------------------
  // UI
  // ----------------------------

  return (
    <div className="app">

      <header className="navbar">
        <div>
          <h1>
            NFT Marketplace
          </h1>
        </div>


        <div className="walletBlock">
          {!account ? (
            <button
              onClick={
                connectWallet
              }
            >
              Connect Wallet
            </button>
          ) : (
            <span className="wallet">
              {account.slice(
                0,
                6
              )}

              ...

              {account.slice(
                -4
              )}
            </span>
          )}
        </div>
      </header>


      <nav className="navigation">

        <button
          className={
            page ===
            "marketplace"
              ? "active"
              : ""
          }
          onClick={() =>
            setPage(
              "marketplace"
            )
          }
        >
          Marketplace
        </button>


        <button
          className={
            page ===
            "my-nfts"
              ? "active"
              : ""
          }
          onClick={() =>
            setPage(
              "my-nfts"
            )
          }
        >
          My NFTs
        </button>


        <button
          className={
            page ===
            "create"
              ? "active"
              : ""
          }
          onClick={() =>
            setPage(
              "create"
            )
          }
        >
          Create NFT
        </button>

      </nav>


      <main>

        {/* MARKETPLACE */}

        {page ===
          "marketplace" && (
          <section>

            <div className="pageTitle">

              <div>
                <h2>
                  Marketplace
                </h2>

                <p>
                  NFTs currently
                  for sale
                </p>
              </div>


              <button
                className="secondary"
                onClick={
                  loadListings
                }
              >
                Refresh
              </button>

            </div>


            {listings.length ===
            0 ? (
              <div className="empty">
                No NFTs for sale
              </div>
            ) : (
              <div className="grid">

                {listings.map(
                  (listing) => (

                    <div
                      className="nftCard"
                      key={
                        listing.nftContract +
                        listing.tokenId
                          .toString()
                      }
                    >

                      <div className="imagePlaceholder">

                        {listing.image ? (
                          <img
                            src={
                              listing.image
                            }
                            alt={
                              listing.name
                            }
                            className="nftImage"
                          />
                        ) : (
                          "NFT"
                        )}

                      </div>


                      <div className="cardContent">

                        <span className="token">
                          NFT #
                          {listing.tokenId
                            .toString()}
                        </span>


                        <h3>
                          {
                            listing.name
                          }
                        </h3>


                        {listing.description && (
                          <p className="description">
                            {
                              listing.description
                            }
                          </p>
                        )}


                        <p className="seller">
                          Seller:{" "}

                          {listing.seller.slice(
                            0,
                            6
                          )}

                          ...

                          {listing.seller.slice(
                            -4
                          )}
                        </p>


                        <div className="price">

                          {ethers.formatEther(
                            listing.price
                          )}

                          {" "}ETH

                        </div>


                        <button
                          onClick={() =>
                            buyNFT(
                              listing
                            )
                          }
                        >
                          Buy NFT
                        </button>

                      </div>
                    </div>

                  )
                )}

              </div>
            )}

          </section>
        )}


        {/* MY NFTs */}

        {page ===
          "my-nfts" && (
          <section>

            <div className="pageTitle">

              <div>
                <h2>
                  My NFTs
                </h2>

                <p>
                  NFTs owned by
                  your wallet
                </p>
              </div>


              <button
                className="secondary"
                onClick={
                  loadMyNFTs
                }
              >
                Refresh
              </button>

            </div>


            {myNFTs.length ===
            0 ? (
              <div className="empty">
                You don't own
                any NFTs
              </div>
            ) : (
              <div className="grid">

                {myNFTs.map(
                  (nft) => (

                    <div
                      className="nftCard"
                      key={
                        nft.tokenId
                          .toString()
                      }
                    >

                      <div className="imagePlaceholder">

                        {nft.image ? (
                          <img
                            src={
                              nft.image
                            }
                            alt={
                              nft.name
                            }
                            className="nftImage"
                          />
                        ) : (
                          "NFT"
                        )}

                      </div>


                      <div className="cardContent">

                        <span className="token">
                          NFT #
                          {nft.tokenId
                            .toString()}
                        </span>


                        <h3>
                          {nft.name}
                        </h3>


                        {nft.description && (
                          <p className="description">
                            {
                              nft.description
                            }
                          </p>
                        )}


                        {nft.listed ? (
                          <>

                            <div className="price">

                              {nft.price
                                ? ethers
                                    .formatEther(
                                      nft.price
                                    )
                                : "0"}

                              {" "}ETH

                            </div>


                            <button
                              className="danger"
                              onClick={() =>
                                cancelListing(
                                  nft.tokenId
                                )
                              }
                            >
                              Cancel Listing
                            </button>

                          </>
                        ) : (
                          <>

                            <input
                              type="number"
                              step="0.01"
                              placeholder="Price in ETH"
                              value={
                                prices[
                                  nft.tokenId
                                    .toString()
                                ] || ""
                              }
                              onChange={(
                                event
                              ) =>
                                setPrices({
                                  ...prices,

                                  [nft.tokenId
                                    .toString()]:
                                    event
                                      .target
                                      .value
                                })
                              }
                            />


                            <button
                              onClick={() =>
                                approveAndList(
                                  nft.tokenId
                                )
                              }
                            >
                              Approve & List
                            </button>

                          </>
                        )}

                      </div>
                    </div>

                  )
                )}

              </div>
            )}

          </section>
        )}


        {/* CREATE NFT */}

        {page === "create" && (

          <section className="createPage">

            <h2>
              Create NFT
            </h2>

            <p>
              Mint a new NFT
              to your wallet
            </p>


            <div className="createCard">

              <label>
                Name
              </label>

              <input
                type="text"
                placeholder="Golden Monkey"
                value={
                  mintName
                }
                onChange={(
                  event
                ) =>
                  setMintName(
                    event.target
                      .value
                  )
                }
              />


              <label>
                Image URL
              </label>

              <input
                type="text"
                placeholder="https://example.com/image.jpg"
                value={
                  mintImage
                }
                onChange={(
                  event
                ) =>
                  setMintImage(
                    event.target
                      .value
                  )
                }
              />


              <label>
                Description
              </label>

              <textarea
                placeholder="Description of your NFT"
                value={
                  mintDescription
                }
                onChange={(
                  event
                ) =>
                  setMintDescription(
                    event.target
                      .value
                  )
                }
              />


              <button
                onClick={
                  mintNFT
                }
              >
                Mint NFT
              </button>

            </div>

          </section>
        )}

      </main>


      <div className="status">

        <strong>
          Status:
        </strong>

        {" "}

        {status || "Ready"}

      </div>

    </div>
  );
}


export default App;