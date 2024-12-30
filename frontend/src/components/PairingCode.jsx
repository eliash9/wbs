import React, { useState } from "react";

const PairingForm = () => {
  const [pairingNumber, setPairingNumber] = useState("");
  const [pairingCode, setPairingCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("https://wbs.fly.dev/pairing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pairingNumber }),
      });

      if (!response.ok) {
        throw new Error("Failed to request pairing code");
      }

      const data = await response.json();
      setPairingCode(data.pairingCode); // Menampilkan pairing code ke user
    } catch (error) {
      console.error(error);
      alert("Error requesting pairing code");
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number:
          <input
            type="text"
            className="border p-2 mb-4 w-full rounded"
            value={pairingNumber}
            onChange={(e) => setPairingNumber(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          className="w-full py-2 px-4 rounded font-medium bg-green-500 hover:bg-green-600 text-white"
        >
          Request Pairing Code
        </button>
      </form>
      
      <div className="flex justify-center items-center space-x-2 mt-4">
        {pairingCode ? (
          pairingCode.split("").map((digit, index) => (
            <div
              key={index}
              className="w-12 h-12 flex justify-center items-center border border-gray-400 rounded-md text-lg font-bold bg-gray-100 shadow-md"
            >
              {digit}
            </div>
          ))
        ) : (
          <p>No Pairing Code</p>
        )}
      </div>
    </div>
  );
};

export default PairingForm;
