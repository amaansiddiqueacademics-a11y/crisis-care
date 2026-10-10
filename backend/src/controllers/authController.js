import {
  loginAdmin,
  loginAmbulanceCrew,
  loginHospital
} from "../services/authService.js";

const respond = (login) => async (req, res) => {
  const { username, password } = req.body;
  const data = await login(username, password);

  res.json({ success: true, message: "Login successful", data });
};

export const hospitalLogin = respond(loginHospital);
export const ambulanceLogin = respond(loginAmbulanceCrew);
export const adminLogin = respond(loginAdmin);
