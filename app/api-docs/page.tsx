"use client";
import "swagger-ui-react/swagger-ui.css";
import SwaggerUI from "swagger-ui-react";

const spec = {
  openapi: "3.0.0",
  info: { title: "GoFresh API", version: "1.0.0" },
  paths: {
    "/api/auth/seed": {
      post: {
        summary: "Seed Admin User",
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { email: { type: "string" }, password: { type: "string" } } }
            }
          }
        },
        responses: { 200: { description: "Success" } }
      }
    }
  }
};

export default function ApiDocs() {
  return <SwaggerUI spec={spec} />;
}