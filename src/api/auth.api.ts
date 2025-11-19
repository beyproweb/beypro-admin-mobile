import api from "./axiosClient";

export async function loginRequest(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

export async function getMe() {
  const { data } = await api.get("/me");
  return data;
}
