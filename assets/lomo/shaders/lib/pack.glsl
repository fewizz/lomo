uint pack(float value, uint bits) {
	uint max_value = 1u << bits;
	return min(uint(value * float(max_value)), max_value - 1u);
}

float unpack(uint value, uint bits) {
	uint max_value = 1u << bits;
	value = value & (max_value - 1u);
	return (float(value) + 0.5) / float(max_value);
}