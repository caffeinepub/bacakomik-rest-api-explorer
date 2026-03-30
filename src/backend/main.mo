import OutCall "http-outcalls/outcall";
import Text "mo:core/Text";

persistent actor {
  // Migration: discard old stable baseUrl variable
  stable var baseUrl : Text = "";

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  public shared ({ caller }) func getPopularComics() : async Text {
    await OutCall.httpGetRequest("https://bacakomik.my/komik-populer/", [], transform);
  };

  public shared ({ caller }) func getLatestComics(page : Nat) : async Text {
    let url = if (page <= 1) {
      "https://bacakomik.my/komik-terbaru/"
    } else {
      "https://bacakomik.my/komik-terbaru/page/".concat(page.toText()).concat("/")
    };
    await OutCall.httpGetRequest(url, [], transform);
  };

  public shared ({ caller }) func getColoredComics(page : Nat) : async Text {
    let url = if (page <= 1) {
      "https://bacakomik.my/komik-berwarna/"
    } else {
      "https://bacakomik.my/komik-berwarna/page/".concat(page.toText()).concat("/")
    };
    await OutCall.httpGetRequest(url, [], transform);
  };

  public shared ({ caller }) func getComicList(page : Nat) : async Text {
    let url = if (page <= 1) {
      "https://bacakomik.my/daftar-komik/"
    } else {
      "https://bacakomik.my/daftar-komik/page/".concat(page.toText()).concat("/")
    };
    await OutCall.httpGetRequest(url, [], transform);
  };

  public shared ({ caller }) func getGenreList() : async Text {
    await OutCall.httpGetRequest("https://bacakomik.my/daftar-genre/", [], transform);
  };
};
