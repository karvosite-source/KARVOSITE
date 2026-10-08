import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
const key=()=>new TextEncoder().encode(process.env.AUTH_SECRET);
export async function createSession(){if(!process.env.AUTH_SECRET)throw new Error("AUTH_SECRET is not configured");return new SignJWT({role:"admin"}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("8h").sign(key())}
export async function isAdmin(){try{const token=(await cookies()).get("karvo_admin")?.value;if(!token||!process.env.AUTH_SECRET)return false;await jwtVerify(token,key());return true}catch{return false}}
