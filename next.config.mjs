/** @type {import('next').NextConfig} */
const nextConfig = {
  // react-chessboard's drag (react-dnd HTML5 backend) breaks under StrictMode's
  // double-mount ("Cannot have two HTML5 backends"). Disabling restores drag.
  reactStrictMode: false,
};

export default nextConfig;
