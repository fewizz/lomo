#include canvas:shaders/pipeline/pipeline.glsl
#include frex:shaders/lib/math.glsl
#include frex:shaders/api/world.glsl
#include lomo:shaders/lib/linear.glsl

uniform samplerCube u_skybox;

layout(location = 0) out vec3 face[6];

vec3 sky(mat3 z_to_w, vec3 dir) {
	int previous_lod = frxu_lod - 1;

	vec3 perp_x = normalize(vec3(-dir.z, 0.0, dir.x));
	vec3 perp_y = cross(dir, perp_x);

	mat3 m = mat3(perp_x, perp_y, dir);

	float radius = PI * 0.7 / pow(2.0, max(0.0, float(7 - previous_lod)));

	vec3 result = vec3(0.0);

	float weight_sum = 0.0;

	const int steps = 5;

	for(int x = 0; x < steps; ++x) {
		for(int y = 0; y < steps; ++y) {
			vec2 c_pos = vec2(x, y) / vec2(steps - 1) * 2.0 - 1.0;

			vec3 r0 = rotation(radius * c_pos.y, vec3(1.0, 0.0, 0.0)) * vec3(0, 0, 1);
			vec3 r1 = rotation(radius * c_pos.x, cross(r0, vec3(1.0, 0.0, 0.0))) * r0;

			float weight = exp(-dot(c_pos, c_pos));

			vec3 t = textureLod(u_skybox, z_to_w * (m * r1), previous_lod).rgb;
			result += t * weight;
			weight_sum += weight;
		}
	}

	return result / weight_sum;
}

void main() {
	// d is a direction to a positive Z
	vec3 d = normalize(
		vec3(gl_FragCoord.xy / frxu_size.xy - 0.5, 0.5)
	);
	d.y *= -1.0;

	const vec3 y_axis = vec3(0, 1, 0);
	const vec3 x_axis = vec3(1, 0, 0);

	// sky function takes world-space view direction
	face[0] = sky(rotation( PI / 2.0, y_axis), d);
	face[1] = sky(rotation(-PI / 2.0, y_axis), d);
	face[2] = sky(rotation(-PI / 2.0, x_axis), d);
	face[3] = sky(rotation( PI / 2.0, x_axis), d);
	face[4] = sky(mat3(1.0),                   d);
	face[5] = sky(rotation( PI,       y_axis), d);
}