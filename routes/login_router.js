const express = require('express')                              // Webserver
const crypto = require('crypto')                                // Random tokens
const bcrypt = require('bcrypt')                                // Password encryption

function getRouter(db, transporter) {
    let router = express.Router()

    router.get('/', function(req, res) {
        res.render('login.ejs', {
            title: "Login",
            email: "",
            redirect: req.query.redirect,
            authenticated: req.session && req.session.userId
        })
    })

    router.post('/', function(req, res) {
        if (req.body.email && req.body.password) {
            db.collection('users').findOne({email:req.body.email}, (err, user) => {
                if (err) return console.log(err)
                if (user) {
                    bcrypt.compare(req.body.password, user.password, (err, result) => {
                        console.log(result)
                        if (result === true) {
                            console.log(req.session)
                            req.session.userId = user._id
                            req.session.admin = user.admin
                            return res.redirect((req.body.redirect !== "/logout" ? req.body.redirect : "") || "/")
                        }
                        else {
                            // Password mismatch
                            return res.redirect('/login')
                        }
                    })
                }
                else {
                    // User not found
                    return res.redirect('/login')
                }
            });
        }
        else {
            return res.redirect('/login')
        }
    })

    return router
}

module.exports = {
    getRouter: getRouter
}