import OutCall "http-outcalls/outcall";
import Text "mo:core/Text";

actor {
  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  let baseUrl = "https://bacakomik.my/wp-json/wp/v2/";

  public shared ({ caller }) func getLatestChapters(page : Nat, perPage : Nat) : async Text {
    let url = baseUrl.concat(
      "posts?_fields=id,title,slug,date,categories&page=",
    ).concat(page.toText()).concat("&per_page=").concat(perPage.toText());
    await OutCall.httpGetRequest(url, [], transform);
  };

  public shared ({ caller }) func searchComics(queryParam : Text, page : Nat) : async Text {
    let url = baseUrl.concat(
      "categories?search=",
    ).concat(queryParam).concat("&per_page=20&page=").concat(page.toText());
    await OutCall.httpGetRequest(url, [], transform);
  };

  public shared ({ caller }) func getComicBySlug(slug : Text) : async Text {
    let url = baseUrl.concat(
      "categories?slug=",
    ).concat(slug);
    await OutCall.httpGetRequest(url, [], transform);
  };

  public shared ({ caller }) func getChaptersByComic(categoryId : Nat, page : Nat) : async Text {
    let url = baseUrl.concat(
      "posts?categories=",
    ).concat(categoryId.toText()).concat("&per_page=20&page=").concat(page.toText()).concat("&_fields=id,title,slug,date");
    await OutCall.httpGetRequest(url, [], transform);
  };
};
