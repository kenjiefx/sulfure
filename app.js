const express = require ('express')
const jwt = require('jsonwebtoken')
const dotenv = require('dotenv')
var cors = require('cors')
const fileupload = require('express-fileupload')
const fs = require('fs')
const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const app = express()
const port = 5050

// get config vars
dotenv.config()

app.use(cors(),fileupload());

app.get('/rotate',function(req,res){
    if (req.query.token===''||req.query.token===undefined) {
        res.status(401)
        res.json({error:'invalid token'})
        return
    }
    jwt.verify(req.query.token, process.env.JWT_SECRET, (err, verifiedJwt) => {
        if (err) {
            res.status(401)
            res.json({error:'invalid token'})
        } else {
            if (Date.now()>(verifiedJwt.exp*1000)) {
                res.status(401)
                res.json({error:'invalid token'})
                return
            }
            const payload = {
                userId: verifiedJwt.userId,
                publicKey: verifiedJwt.publicKey,
                for: verifiedJwt.for,
                role: verifiedJwt.role,
                permissions: verifiedJwt.permissions,
                status: verifiedJwt.status,
                exp: (Math.floor(Date.now()/1000))+600
            }
            const token = jwt.sign(payload,process.env.JWT_SECRET)

            res.status(200)
            res.json({
                token:token,
                exp:'7min'
            })
        }
    })
})

app.post('/push',function(req,res){

    if (req.query.token===''||req.query.token===undefined) {
        res.status(401)
        res.json({error:'invalid token'})
        return
    }

    // Requiring token for this endpoint
    jwt.verify(req.query.token, process.env.JWT_SECRET, (err, verifiedJwt) => {
        if (err) {
            res.status(401)
            res.json({error:'invalid token'})
            return
        } else {
            if (Date.now()>(verifiedJwt.exp*1000)) {
                res.status(401)
                res.json({error:'invalid token'})
                return
            }

            const fileName = req.files.myFile.name
            const path = __dirname + '/tmp/images/' + fileName


            req.files.myFile.mv(path, (error) => {
                if (error) {
                  res.status(500)
                  res.json({error:'internal server error'})
                  return
                }

                const fileContent = fs.readFileSync(path);

                const s3 = new AWS.S3({
                    accessKeyId: process.env.AS3_ACCESSKEY,
                    secretAccessKey: process.env.AS3_SECRETKEY
                });

                // Generating a new unique id for the uploaded file
                fileUid = uuidv4()

                const params = {
                    Bucket: process.env.AS3_BUCKETNAME,
                    Key: fileUid+'.jpg',
                    Body: fileContent
                };

                s3.upload(params, function(error, data) {

                    if (error) {
                        res.status(500)
                        res.json({error:'internal server error'})
                        return
                    }

                    // Deleting the file from the tmp/images directory
                    fs.unlink(path)

                    // Sending response together with the path of the uploaded image
                    res.status(200)
                    res.json({message:'success',path:'https://jackfruit-cdn.s3.ap-southeast-1.amazonaws.com/'+fileUid+'.jpg'})

                    return;
                });

            })


        }
    })






})

app.use(function(req, res){
    res.status(404)
    res.json({error:'path not found'})
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
