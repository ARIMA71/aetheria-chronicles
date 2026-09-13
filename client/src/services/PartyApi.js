import { API_BASE } from '../config.js';

class PartyApi {
    static async getPresets(playerId) {
        try {
            const response = await fetch(`${API_BASE}/api/party/${playerId}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching party presets:', error);
            return { status: 'error' };
        }
    }

    static async getInventory(playerId) {
        try {
            const response = await fetch(`${API_BASE}/api/party/${playerId}/inventory/all`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching inventory:', error);
            return { status: 'error' };
        }
    }

    static async getMcSkills(playerId) {
        try {
            const response = await fetch(`${API_BASE}/api/party/${playerId}/mc-skills/all`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching MC skills:', error);
            return { status: 'error' };
        }
    }

    static async savePreset(playerId, presetSlot, data) {
        try {
            const response = await fetch(`${API_BASE}/api/party/${playerId}/${presetSlot}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('Error saving preset:', error);
            return { status: 'error' };
        }
    }

    static async limitBreak(playerId, inv_id) {
        try {
            const response = await fetch(`${API_BASE}/api/party/${playerId}/limit-break`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inv_id })
            });
            return await response.json();
        } catch (error) {
            console.error('Error in Limit Break:', error);
            return { status: 'error', message: 'Network Error' };
        }
    }
}

export default PartyApi;
