const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwtToken = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const dateBaseServerConnection = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log(`Server has been started at port number:3000`);
    });
  } catch (error) {
    console.log(`DB Error:${error.message}`);
  }
};
dateBaseServerConnection();

//=================API-1====================
const userExits = async (username) => {
  const query = `SELECT * FROM USER where username="${username}"`;
  const result = await db.get(query);
  return result;
};
const passWordLength = (password) => {
  return password.length < 6;
};

const middleWareAuthenticate = (req, res, next) => {
  let getUserJwtToken;
  const authHeader = req.headers["authorization"];
  console.log();

  if (authHeader !== undefined) {
    getUserJwtToken = authHeader.split(" ")[1];
    console.log(authHeader);
    //console.log("haihai");
  }
  if (getUserJwtToken === undefined) {
    res.status(401);
    res.send(`Invalid JWT Token`);
  } else {
    jwtToken.verify(
      getUserJwtToken,
      "USER_SECRET_TOKEN",
      async (error, payload) => {
        if (error) {
          res.status(401);
          res.send(`Invalid JWT Token`);
        } else {
          console.log(payload);
          next();
        }
      }
    );
  }
};

app.post(`/register/`, async (req, res) => {
  const { username, password, name, gender } = req.body;
  const dbUser = await userExits(username);

  const passwordLength = passWordLength(password);
  console.log(passwordLength);
  if (dbUser !== undefined || passwordLength === true) {
    if (dbUser !== undefined) {
      res.status(400);
      res.send(`User already exists`);
    } else {
      res.status(400);
      res.send(`Password is too short`);
    }
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `INSERT INTO user(name,username,password,gender) VALUES("${name}","${username}","${hashedPassword}","${gender}")`;
    await db.run(query);
    res.status(200);
    res.send(`User created successfully`);
  }
});

//============API-2====================

const checkPassword = async (password, dbUserPassword) => {
  console.log(password + "  " + dbUserPassword);
  const isPasswordMatch = await bcrypt.compare(password, dbUserPassword);
  return isPasswordMatch;
};
app.post(`/login/`, async (req, res) => {
  const { username, password } = req.body;
  const dbUser = await userExits(username);
  console.log(dbUser);
  if (dbUser === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const dbPassword = await checkPassword(password, dbUser.password);
    console.log(dbPassword);
    if (dbPassword === false) {
      res.status(400);
      res.send(`Invalid password`);
    } else {
      const payload = { username: dbUser.username };
      const jwtUserToken = jwtToken.sign(payload, "USER_SECRET_TOKEN");
      res.send({ jwtToken: jwtUserToken });
    }
  }
});

//=============API-3==============
app.get(`/user/tweets/feed/`, middleWareAuthenticate, async (req, res) => {
  const followingUserIdQuery = `SELECT user.username,tweet.tweet,tweet.date_time as dateTime   FROM (tweet INNER JOIN follower ON 
    follower.following_user_id=tweet.user_id ) as DUP INNER JOIN USER ON user.user_id=tweet.user_id ORDER BY dateTime DESC LIMIT 4 OFFSET 1`;
  const getFollowingIds = await db.all(followingUserIdQuery);
  console.log(getFollowingIds);
  res.send(getFollowingIds);
});

//==============API-4==============

app.get(`/user/following/`, middleWareAuthenticate, async (req, res) => {
  const followingUsers = `SELECT user.username FROM (tweet INNER JOIN follower ON 
    follower.following_user_id=tweet.user_id ) as DUP INNER JOIN USER ON user.user_id=tweet.user_id GROUP BY username`;
  const result = await db.all(followingUsers);
  res.send(result);
});
//------------------export module-----------------------------
module.exports = app;
