function setUrlParam(url, param, value) {
    let queryString = url.search;
    let searchParams = new URLSearchParams(queryString); 
    searchParams.set(param, value);
    let newUrl = new URL(url);
    newUrl.search = searchParams.toString();
    return newUrl.toString();
}