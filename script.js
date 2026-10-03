// Search Function
function searchWebsite() {

    let searchText = document.getElementById("searchBox").value;

    if (searchText === "") {

        alert("Please enter something to search.");

    } else {

        alert("You searched for: " + searchText);

    }
}


// Join Us Function
function joinUs() {

    alert("Welcome to PraRoz! Thank you for joining us.");

}


// Login Function
function loginUser() {

    let email = document.getElementById("email").value;
    let password = document.getElementById("password").value;


    if (email === "" || password === "") {

        alert("Please enter Email and Password.");

    } else {

        alert("Login successful!");

    }

}