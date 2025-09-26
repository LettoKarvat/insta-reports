import api from "./api";

export interface HumanCheckResponse {
  human_token: string;
  expires_in: number;
}
export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

const mockDelay = () => new Promise((resolve) => setTimeout(resolve, 800));

export async function postHumanCheck(
  photoData: Blob | FormData | { photo: string } | string
): Promise<HumanCheckResponse> {
  const useMock = import.meta.env.VITE_USE_MOCK === "true";

  if (useMock) {
    await mockDelay();
    return { human_token: "mock_token_" + Date.now(), expires_in: 300 };
  }

  if (photoData instanceof FormData) {
    const response = await api.post<HumanCheckResponse>(
      "/auth/human-check",
      photoData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return response.data;
  }

  if (photoData instanceof Blob) {
    const fd = new FormData();
    fd.append("photo", photoData, "frame.jpg");
    const response = await api.post<HumanCheckResponse>(
      "/auth/human-check",
      fd,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return response.data;
  }

  if (typeof photoData === "string") {
    const response = await api.post<HumanCheckResponse>(
      "/auth/human-check",
      { photo: photoData },
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    return response.data;
  }

  const response = await api.post<HumanCheckResponse>(
    "/auth/human-check",
    photoData,
    {
      headers: { "Content-Type": "application/json" },
    }
  );
  return response.data;
}

export async function postLogin(data: {
  usernameOrEmail: string;
  password: string;
  human_token: string;
}): Promise<LoginResponse> {
  const useMock = import.meta.env.VITE_USE_MOCK === "true";

  if (useMock) {
    await mockDelay();
    return {
      access_token: "mock_jwt_token",
      user: {
        id: "mock_user_id",
        email: data.usernameOrEmail,
        name: "Usuário Mock",
      },
    };
  }

  const response = await api.post<LoginResponse>("/auth/login", data);
  return response.data;
}
