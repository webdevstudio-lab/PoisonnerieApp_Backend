import jwt from "jsonwebtoken";

export const generateAccessToken = async (Id, role) => {
  try {
    const accessTokenOptions = {
      expiresIn: process.env.JWT_EXPIRES_IN,
      secret: process.env.JWT_SECRET,
      audience: ["user"],
      algorithm: "HS256",
    };

    const accessToken = jwt.sign({ Id, role }, accessTokenOptions.secret, {
      expiresIn: accessTokenOptions.expiresIn,
      audience: accessTokenOptions.audience,
      algorithm: accessTokenOptions.algorithm,
    });

    return accessToken;
  } catch (e) {
    console.log(`Error generating access token: ${e}`);
    throw e;
  }
};

export const generateRefreshToken = async (Id) => {
  try {
    const refreshTokenOptions = {
      expiresIn: process.env.JWT_EXPIRES_IN,
      audience: ["user"],
      algorithm: "HS256",
    };

    const accessToken = jwt.sign({ Id }, process.env.JWT_SECRET, {
      expiresIn: refreshTokenOptions.expiresIn,
      audience: refreshTokenOptions.audience,
      algorithm: refreshTokenOptions.algorithm,
    });

    return accessToken;
  } catch (e) {
    console.log(`Error generating access token: ${e}`);
    throw e;
  }
};

export const verifyRefreshToken = async (token) => {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET_REFRESH);
    return { payload };
  } catch (e) {
    console.log(`Error verifying token: ${e}`);
    throw e;
  }
};
