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
let user_id_from_middleWare;

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

const middleWareAuthenticate = async (req, res, next) => {
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
          const query = `SELECT user_id FROM user WHERE username="${payload.username}"`;
          const result = await db.get(query);
          user_id_from_middleWare = result.user_id;
          console.log(user_id_from_middleWare);
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
      console.log(dbUser.user_id);
    }
  }
});

//=============API-3==============
app.get(`/user/tweets/feed/`, middleWareAuthenticate, async (req, res) => {
  const followingUserIdQuery = `SELECT user.username,tweet.tweet,tweet.date_time as dateTime   FROM (follower INNER JOIN tweet ON 
   follower.following_user_id=tweet.user_id ) as DUP INNER JOIN USER ON user.user_id=tweet.user_id WHERE follower.follower_user_id =${user_id_from_middleWare} ORDER BY dateTime DESC LIMIT 4`;
  const getFollowingIds = await db.all(followingUserIdQuery);
  console.log(getFollowingIds);
  res.send(getFollowingIds);
});

//==============API-4==============

app.get(`/user/following/`, middleWareAuthenticate, async (req, res) => {
  const followingUsers = `SELECT user.username as name FROM (user INNER JOIN follower ON 
    follower.following_user_id=user.user_id ) WHERE follower.follower_user_id =${user_id_from_middleWare}   `;
  const result = await db.all(followingUsers);
  res.send(result);
});

//================API-5

app.get(`/user/followers/`, middleWareAuthenticate, async (req, res) => {
  const followingUsers = `SELECT user.username as name FROM (user INNER JOIN follower ON 
    follower.follower_user_id=user.user_id ) WHERE follower.following_user_id =${user_id_from_middleWare}   `;
  const result = await db.all(followingUsers);
  res.send(result);
});

//===============API-6

app.get(`/tweets/:tweetId/`, middleWareAuthenticate, async (req, res) => {
  const { tweetId } = req.params;
  const user_id_by_tweet_id = `SELECT user_id from tweet where tweet_id=${tweetId}`;

  const result_query_user_id = await db.get(user_id_by_tweet_id);
  const list = `select following_user_id from follower where follower_user_id=${user_id_from_middleWare}`;
  console.log(list);
  const resultList = await db.all(list);

  const following_user_list = resultList.map((item) => item.following_user_id);
  console.log(following_user_list);
  const tweet_user_id = result_query_user_id.user_id;
  console.log(tweet_user_id);
  if (following_user_list.includes(tweet_user_id)) {
    const query = `SELECT tweet.tweet, count(like.tweet_id) as likes, count(reply.tweet_id) as replies, tweet.date_time as dateTime from tweet 
    inner join like on  tweet.tweet_id=like.tweet_id inner join reply on  reply.tweet_id=tweet.tweet_id WHERE tweet.tweet_id=${tweetId} `;

    const result = await db.get(query);
    console.log(result);

    res.send(result);
  } else {
    res.status(401);
    res.send("Invalid Request");
  }
});

//==============API-7===================

app.get(`/tweets/:tweetId/likes/`, middleWareAuthenticate, async (req, res) => {
  const { tweetId } = req.params;
  const user_id_by_tweet_id = `SELECT user_id from tweet where tweet_id=${tweetId}`;

  const result_query_user_id = await db.get(user_id_by_tweet_id);
  const list = `select following_user_id from follower where follower_user_id=${user_id_from_middleWare}`;
  console.log(list);
  const resultList = await db.all(list);

  const following_user_list = resultList.map((item) => item.following_user_id);
  console.log(following_user_list);
  const tweet_user_id = result_query_user_id.user_id;
  console.log(tweet_user_id);
  if (following_user_list.includes(tweet_user_id)) {
    const query = `select user.username from user inner join like on user.user_id=like.user_id WHERE 
                    like.tweet_id=${tweetId}`;

    const result = await db.all(query);
    console.log(result);

    res.send(result);
  } else {
    res.status(401);
    res.send("Invalid Request");
  }
});

//===============API-8

app.get(
  `/tweets/:tweetId/replies/`,
  middleWareAuthenticate,
  async (req, res) => {
    const { tweetId } = req.params;
    const user_id_by_tweet_id = `SELECT user_id from tweet where tweet_id=${tweetId}`;
    console.log(user_id_by_tweet_id);
    const result_query_user_id = await db.get(user_id_by_tweet_id);
    console.log(result_query_user_id);
    const list = `select following_user_id from follower where follower_user_id=${user_id_from_middleWare}`;
    console.log(list);
    const resultList = await db.all(list);

    const following_user_list = resultList.map(
      (item) => item.following_user_id
    );
    console.log(following_user_list);
    const tweet_user_id = result_query_user_id.user_id;
    console.log(tweet_user_id);
    if (following_user_list.includes(tweet_user_id)) {
      const query = `select user.username as name,reply.reply from user inner join reply on
                        user.user_id=reply.user_id
      WHERE tweet_id=${tweetId}`;

      const result = await db.all(query);
      console.log(result);

      res.send({ replies: result });
    } else {
      res.status(401);
      res.send("Invalid Request");
    }
  }
);

//=======================API -9===============

app.get(`/user/tweets/`, middleWareAuthenticate, async (req, res) => {
  const query = `select tweet.tweet, count(like.user_id) as c  from tweet inner join like on tweet.user_id=like.user_id where tweet.user_id=${user_id_from_middleWare}`;
  const result = await db.all(query);
  console.log(result);
});

//=============API-10===================

app.post("/user/tweets/", middleWareAuthenticate, async (req, res) => {
  const reqBody = req.body;
  console.log(reqBody);
  const query = `INSERT INTO tweet(tweet) values("${reqBody.tweet}")`;
  await db.run(query);
  res.send("Created a Tweet");
});

//==============API-10================
app.delete("/tweets/:tweetId/", middleWareAuthenticate, async (req, res) => {
  const { tweetId } = req.params;
  const query = `DELETE FROM tweet WHERE tweet_id=${tweetId}`;
  await db.run(query);
  res.send("Tweet Removed");
});
//------------------export module-----------------------------
module.exports = app;
