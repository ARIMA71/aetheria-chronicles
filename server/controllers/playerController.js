exports.getPlayer = (req, res) => {
    const { id } = req.params;

    res.json({
        message: 'Get Player Data Hit',
        playerId: id
    });
};