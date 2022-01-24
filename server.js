// server.js
// where your node app starts

// include modules
const express = require('express');

const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs');
const sql = require("sqlite3").verbose();
const postDB = new sql.Database("postcards.db");
const FormData = require("form-data");

let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, __dirname+'/images')    
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
// let upload = multer({dest: __dirname+"/assets"});
let upload = multer({storage: storage});

function makeid(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function createPostCardTable() {
  const cmd = 'CREATE TABLE IF NOT EXISTS PostcardTable  ( cardId TEXT PRIMARY KEY, message TEXT, font TEXT, color TEXT, image TEXT)';
  postDB.run(cmd, function(err, val) {
    if (err) {
      console.log("Database creation failure", err.message);
    } else {
      console.log("Created Table");
    }
  });
}

function sendMediaStore(filepath, response) {
  let apiKey = 'uj28q4n8m0';
  if (apiKey === undefined) {
    response.status(400);
    response.send("No API key provided");
  } else {
    // we'll send the image from the server in a FormData object
    let form = new FormData();
    
    // we can stick other stuff in there too, like the apiKey
    form.append("apiKey", apiKey);
    // stick the image into the formdata object
    form.append("storeImage", fs.createReadStream(filepath));
    // and send it off to this URL
    form.submit("http://ecs162.org:3000/fileUploadToAPI", function(err, APIres) {
      // did we get a response from the API server at all?
      if (APIres) {
        // OK we did
        console.log("API response status", APIres.statusCode);
        // the body arrives in chunks - how gruesome!
        // this is the kind stream handling that the body-parser 
        // module handles for us in Express.  
        let body = "";
        APIres.on("data", chunk => {
          body += chunk;
        });
        APIres.on("end", () => {
          // now we have the whole body
          if (APIres.statusCode != 200) {
            response.status(400); // bad request
            response.send(" Media server says: " + body);
          } else {
            response.status(200);
            response.send(body);
          }
        });
      } else { // didn't get APIres at all
        response.status(500); // internal server error
        response.send("Media server seems to be down.");
      }
    });
  }
}
// begin constructing the server pipeline
const app = express();



// Serve static files out of public directory
app.use(express.static('public'));

// Also serve static files out of /images
app.use("/images",express.static('images'));

// Handle GET request to base URL with no other route specified
// by sending creator.html, the main page of the app
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/public/creator.html');
});

app.get("/showPostcard", function (request, response) {
  const id = request.query.id;
  console.log(id);
  const cmd = "SELECT * FROM PostcardTable WHERE cardId = ? ";
  postDB.all(cmd,id,function(err, data) {
    if (data.length == 0 || err) {
      response.status(404).send('Not Found');
    } else {
      const result = data[0];
      response.status(200).json(result);
    }
  });
});

// Next, the the two POST AJAX queries

// Handle a post request to upload an image. 
app.post('/upload', upload.single('newImage'), function (request, response) {
  const filename = request.file.originalname;
  sendMediaStore(__dirname + '/images/' + filename, response);
});

// Handle a post request containing JSON
app.use(bodyParser.json());
// gets JSON data into req.body
app.post('/saveDisplay', function (req, res) {
  const message = req.body.message;
  const font = req.body.font;
  const color = req.body.color;
  const image = req.body.image || null;
  const id = makeid(24);
  // write the JSON into postcardData.json
  const cmd = "INSERT INTO PostcardTable ( cardId, message, font, color, image ) VALUES (?,?,?,?,?) ";
  postDB.run(cmd,id,message,font,color,image,function(err) {
    if(err) {
      console.log(err);
      res.status(404).send('postcard not saved');
    } else {
      res.send(id);
    }
  });
});


// The GET AJAX query is handled by the static server, since the 
// file postcardData.json is stored in /public

// listen for requests :)
var listener = app.listen(3000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
  createPostCardTable();
});
