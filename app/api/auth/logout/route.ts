// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const response = NextResponse.json({ success: true, message: "Session terminated cleanly." }, { status: 200 });
    
    // Clear the authentication cookie by setting its expiration to the past
    response.cookies.set('gofresh_session', '', {
      path: '/',
      httpOnly: true,
      expires: new Date(0), // Instantly invalidates cookie context
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "Logout execution failure." }, { status: 500 });
  }
}