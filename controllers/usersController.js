const db = require("../models");
const Users = db.user;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const getUsers = async (req, res) => {
  const users = await Users.findAll({
    attributes: ["id", "name", "email"],
  });
  res.status(200).send(users);
};

const Register = async (req, res) => {
  const { name, email, password, confPassword } = req.body;
  const filter = /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+.)+([a-zA-Z0-9]{2,4})+$/;

  if (password !== confPassword)
    return res
      .status(400)
      .json({ msg: "Password dan Confirm Password tidak cocok" });

  if (!password || password.length < 0) {
    return res.status(400).json({ msg: "Password tidak boleh kosong" });
  } else if (!password || password.length < 8) {
    return res.status(400).json({ msg: "Password minimal harus 8 karakter" });
  }
  if (!name || name.length < 0) {
    return res.status(400).json({ msg: "Username tidak boleh kosong" });
  } else if (!name || name.length < 8) {
    return res.status(400).json({ msg: "Username minimal harus 8 karakter" });
  }

  if (!email || email.length < 0) {
    return res.status(400).json({ msg: "Email tidak boleh kosong " });
  } else if (!filter.test(email)) {
    return res.status(400).json({ msg: "Harap sertakan '@' di email " });
  }

  const salt = await bcrypt.genSalt();
  const hashPassword = await bcrypt.hash(password, salt);
  let info = {
    name: name,
    email: email,
    password: hashPassword,
  };

  const users = await Users.create(info);
  res.status(200).send(users);
  res.json({ msg: "Register Berhasil" });
};

const Login = async (req, res) => {
  const { email, password } = req.body;
  const filter = /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+.)+([a-zA-Z0-9]{2,4})+$/;

  if (!password || password.length < 0)
    return res.status(400).json({ msg: "Password tidak boleh kosong" });

  if (!email || email.length < 0)
    return res.status(400).json({ msg: "Email tidak boleh kosong " });

  if (!filter.test(email))
    return res.status(400).json({ msg: "Harap sertakan '@' di email " });

  try {
    const user = await Users.findAll({
      where: {
        email: req.body.email,
      },
    });
    const match = await bcrypt.compare(req.body.password, user[0].password);
    if (!match) return res.status(400).json({ msg: "Password salah" });
    const userId = user[0].id;
    const name = user[0].name;
    const email = user[0].email;
    const accessToken = jwt.sign(
      { userId, name, email },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: "20s",
      }
    );
    const refreshToken = jwt.sign(
      { userId, name, email },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: "1d",
      }
    );
    await Users.update(
      { refresh_token: refreshToken },
      {
        where: {
          id: userId,
        },
      }
    );
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken });
  } catch (error) {
    res.status(404).json({ msg: "Email tidak ditemukan" });
  }
};

const Logout = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.sendStatus(204);
  const user = await Users.findAll({
    where: {
      refresh_token: refreshToken,
    },
  });
  if (!user[0]) return res.sendStatus(204);
  const userId = user[0].id;
  await Users.update(
    { refresh_token: null },
    {
      where: {
        id: userId,
      },
    }
  );
  res.clearCookie("refreshToken");
  return res.sendStatus(200);
};

module.exports = {
  getUsers,
  Register,
  Login,
  Logout,
};
