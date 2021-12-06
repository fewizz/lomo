/* lomo:lib/plane.glsl */

struct plane {
	vec3 normal;
	float d;
};

plane plane_from_pos_and_normal(vec3 pos, vec3 normal) {
	return plane(normal, -dot(normal, pos));
}