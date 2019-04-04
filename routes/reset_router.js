const express = require('express');                             // Webserver
const crypto = require('crypto');                               // Random tokens
const bcrypt = require('bcrypt');                               // Password encryption

function getRouter(db, transporter) {
    let router = express.Router();

    router.get('/', (req, res) => {
        // Show the password reset form
        res.render('reset.ejs', {
            title: "Reset password",
        });
    });

    router.post('/request', (req, res) => {
        // Find the user associated with the email address
        db.collection('users').findOne({email:req.body.email}, (err, user) => {
            if (err) {
                res.send(`Failed to send link to ${req.body.email}, user not found`);
                console.error(err);
            }
            else {
                try {
                    // Create token
                    let token = crypto.randomBytes(20).toString('hex');
                    // Insert token into the database, valid for one hour
                    db.collection("users").updateOne({_id:user._id}, {$set:{resetToken:token, resetTokenExpires:Date.now()+60*60*1000}});
                    // Create reset url
                    let url = `${req.protocol}://${req.get('host')}/reset/confirm?token=${token}`;
                    // TODO: better mail text
                    const mailOptions = {
                        from: process.env.MAIL_ADDRESS,
                        to: req.body.email,
                        subject: 'Password reset request',
                        html: `Click or copy this link to reset your password
                        <a href="${url}">${url}</a>`
                    };
                    // Send email
                    transporter.sendMail(mailOptions, (err, info)=>{
                        if(err) {
                            console.error(err);
                            res.send(`Failed to send link to ${req.body.email}, send mail error`);
                        }
                        else {
                            console.log(info);
                            res.send(`Reset link sent to ${req.body.email}`);
                        }
                    });
                }
                catch (err) {
                    res.send(`Failed to send link to ${req.body.email}`);
                    console.error("error", err);
                }
            }
        });
    });

    router.get('/confirm', (req, res) => {
        // Search for the user associated with the token
        db.collection('users').findOne({resetToken:req.query.token, resetTokenExpires:{$gt:Date.now()}}, (err, user) => {
            if (err) {
                res.send(`Reset token no longer valid`);
                console.error(err);
            }
            else {
                // Show the form to enter the new password
                res.render('reset_confirm.ejs', {
                    title: "Reset password",
                    token: req.query.token
                });
            }
        });
    });

    router.post('/password', (req, res) => {
        db.collection('users').findOne({resetToken:req.body.token, resetTokenExpires:{$gt:Date.now()}}, (err, user) => {
            if (err) {
                res.send(`Reset token no longer valid, user not found`);
                console.error(err);
            }
            else {
                try {
                    // Set the new password and erase the token information
                    bcrypt.hash(req.body.password, 10, function (err, hash){
                        if (err) {
                            res.send(`Reset token no longer valid`);
                            console.error("error", err);
                        }
                        else {
                            db.collection("users").updateOne({_id:user._id}, {$set:{password:hash}, $unset:{resetToken:"", resetTokenExpires:""}});
                            res.send(`Password has been reset`);
                        }
                    });
                }
                catch (err) {
                    res.send(`Reset token no longer valid`);
                    console.error("error", err);
                }
            }
        });
    });

    return router;
}

module.exports = {
    getRouter: getRouter
};