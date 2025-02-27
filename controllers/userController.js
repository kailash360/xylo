const bcrypt = require("bcrypt");
const connection = require("../db/db");
const noError = { isError: false, msgTitle: "", msgBody: "" };
var postId = undefined;

exports.admin = (req, res) => {
  if (req.session.userId) {
    if (req.session.userType == "A") res.redirect("/dashboard");
    else res.status(403).send("Not allowed");
  } else res.render("login", noError);
}

exports.redirectToLogin = (req, res) => {
  if (req.session.userId)
    req.session.userType == "A" ?
    res.redirect("/dashboard") :
    res.redirect("/stories");
  else
    res.render("login", {
      email: req.query.mail,
      isError: false,
      msgTitle: "",
      msgBody: ""
    });
}

exports.redirectToRegister = (req, res) => {
  if (req.session.userId)
    req.session.userType == "A" ?
    res.redirect("/dashboard") :
    res.redirect("/stories");
  else res.render("register", noError);
}

exports.dashboard = (req, res) => {
  userId = undefined;
  if (req.session.userId) {
    if (req.session.userType == "A") {
      res.render(
        "dashboard", {
          uid: req.session.userId,
          name: req.session.userName,
          loading: true,
          posts: []
        },
        (e, html) => {
          let query =
            "select * from posts where uid = " +
            connection.escape(parseInt(req.session.userId));
          let postList = [];
          connection.query({ sql: query, timeout: 30000, typeCast: false },
            (e, result) => {
              if (e) {
                res.status(500).render("errorPage", {
                    error: "Server Error\n" + e.sqlMessage,
                    errorCode: 500
                });
              }
              if (result.length) {
                result.forEach(element => {
                    postList.push(element);
                });

                if (postId.length) {
                    connection.query({
                          sql: "update posts set fileurl = " +
                              connection.escape(
                                  req.query.fileurl.substring(
                                      1,
                                      req.query.fileurl.length - 2
                                  )
                              ) +
                              " where id = " +
                              connection.escape(postId),
                          timeout: 30000
                        },
                        e => {
                            if (e)
                                res.status(500).render("errorPage", {
                                    error: "Server Error\n" + e.sqlMessage,
                                    errorCode: 500
                                });
                        }
                    );
                }

                postList.forEach(element => {
                  fx = element.fileurl;
                  if (fx != "test") {
                    fileurl2 =
                      "https://drive.google.com/uc?id=" +
                      fx.slice(fx.search("d/") + 2, fx.search("/view"));
                    element.fileurl = fileurl2;
                  }
                });

                res.render("dashboard", {
                  uid: req.session.userId,
                  name: req.session.userName,
                  loading: false,
                  posts: postList
                });
              } else {
                res.render("dashboard", {
                  uid: req.session.userId,
                  name: req.session.userName,
                  loading: false,
                  posts: []
                });
              }
            }
          );
        }
      );
    }
  } else res.status(401).redirect("/login");
}


exports.logout = (req, res) => {
    if (req.session.userId) {
        req.session.destroy(() => {
            res.status(200).redirect("/");
        });
    } else res.status(400).redirect("/login");
}

exports.error_GET = (req, res) => {
    res
        .status(404)
        .render("errorPage", { error: "Page Not Found", errorCode: 404 });
}

exports.uploadPost = (req, res) => {
    connection.query("SELECT CURRENT_DATE() as date", (e2, rows) => {
        if (e2)
            res.status(500).render("errorPage", {
                error: "Server Error\n" + e2.sqlMessage,
                errorCode: 500
            });
        const val = [
            [
                req.body.title,
                rows[0].date,
                req.body.place,
                req.body.content,
                req.session.userId,
                req.session.userName,
                "test"
            ]
        ];
        connection.query(
            "INSERT INTO posts (title, post_date, place, content, uid, author, fileurl) values ?", [val],
            (e, dbResult) => {
                if (e)
                    res.status(500).render("errorPage", {
                        error: "Server Error\n" + e.sqlMessage,
                        errorCode: 500
                    });
                else postId = dbResult.insertId;
            }
        );
    });

    res.end("<script>window.close();</script>");
}

exports.register = (req, res) => {
    const { name, mail, pass, pass2 } = req.body;
    var e = [];

    if (!name || !mail || !pass || !pass2)
        res.render("register", {
            isError: true,
            msgTitle: "Invalid Input",
            msgBody: "Please fill-in all the details."
        });

    if (pass != pass2) e.push("Passwords do not match");
    if (pass.length < 6) e.push("Weak Password");

    // 20s timeout
    connection.query({ sql: "select * from users where email=?", timeout: 20000 }, [mail],
        (er, row) => {
            if (er)
                res.status(500).render("errorPage", {
                    error: "Server Error\n" + er.sqlMessage,
                    errorCode: 500
                });
            if (row.length) res.redirect(`/login?mail=${mail}`);
            if (e.length) {
                var eList = "";
                e.forEach((error, i) => {
                    if (i == 0) eList = error;
                    else eList = eList + ", " + error;
                });

                res.render("register", {
                    isError: true,
                    msgTitle: "Error",
                    msgBody: eList
                });
            } else {
                bcrypt.hash(pass, 10, (e, hash) => {
                    if (e)
                        res.status(500).render("errorPage", {
                            error: "Server Error\n" + e.message,
                            errorCode: 500
                        });
                    var query = "insert into users (name, email, password_hash) values ?";
                    const val = [
                        [name, mail, hash]
                    ];
                    connection.query({ sql: query, timeout: 20000 }, [val], err => {
                        if (err)
                            res
                            .status(500)
                            .render("errorPage", { error: err, errorCode: 500 });
                        else res.redirect(`/login?mail=${mail}`);
                    });
                });
            }
        }
    );
}

exports.login = (req, res) => {
    postId = undefined;
    const { mail, pass } = req.body;

    if (!mail || !pass)
        res.render("login", {
            isError: true,
            email: mail,
            msgTitle: "Invalid Input",
            msgBody: "Please fill-in all the details."
        });
    else {
        connection.query({ sql: "select * from users where email=?", timeout: 20000 }, [mail],
            (e, row) => {
                if (e)
                    res.status(500).render("errorPage", {
                        error: "Server Error\n" + er.sqlMessage,
                        errorCode: 500
                    });
                if (row.length) {
                    const user = row[0];

                    bcrypt.compare(pass, user.password_hash, (e, result) => {
                        if (e)
                            res.status(500).render("errorPage", {
                                error: "Server Error\n" + er.sqlMessage,
                                errorCode: 500
                            });
                        if (result) {
                            req.session.userId = user.id;
                            req.session.userName = user.name;
                            req.session.userType = user.user_type;
                            req.session.userType == "A" ?
                                res.redirect("/dashboard") :
                                res.redirect("/stories");
                        } else {
                            res.render("login", {
                                email: mail,
                                isError: true,
                                msgTitle: "Invalid Credentials",
                                msgBody: "Incorrect E-Mail ID or Password"
                            });
                        }
                    });
                } else {
                    res.render("login", {
                        email: mail,
                        isError: true,
                        msgTitle: "Invalid Credentials",
                        msgBody: "Incorrect E-Mail ID or Password"
                    });
                }
            }
        );
    }
}

exports.error_POST = (req, res) => {
    res
        .status(400)
        .render("errorPage", { error: "Invalid request", errorCode: 400 });
}