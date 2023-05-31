#include lomo:shaders/lib/ray_plane.glsl
#include frex:shaders/api/world.glsl

uniform sampler2D u_depth;

layout(location = 0) out float out_depth;

vec2 taa_offset() {
	// 0: -0.25, -0.25
	// 1:  0.25, -0.25
	// 2: -0.25,  0.25
	// 3:  0.25,  0.25
	uint i = frx_renderFrames;
	return (
		vec2(float(i % 2u), float((i / 2u) % 2u)) - 0.5
	) * 0.5;
}

void main() {
	float depth = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;

	vec2 pos_win = gl_FragCoord.xy;
	float xs[2] = float[2](
		texelFetch(u_depth, ivec2(pos_win) + ivec2(-1,  0), 0).r,
		texelFetch(u_depth, ivec2(pos_win) + ivec2( 1,  0), 0).r
	);
	int closest_x = abs(depth - xs[0]) < abs(depth - xs[1]) ? -1 : 1;
	float ys[2] = float[2](
		texelFetch(u_depth, ivec2(pos_win) + ivec2( 0, -1), 0).r,
		texelFetch(u_depth, ivec2(pos_win) + ivec2( 0,  1), 0).r
	);
	int closest_y = abs(depth - ys[0]) < abs(depth - ys[1]) ? -1 : 1;

	float dx = float(closest_x) * (xs[(closest_x + 1)/2] - depth);
	float dy = float(closest_y) * (ys[(closest_y + 1)/2] - depth);

	vec3 win_normal = normalize(
		cross(vec3(1.0, 0.0, dx), vec3(0.0, 1.0, dy))
	);

	plane p = plane_from_pos_and_normal(
		vec3(0.0),
		win_normal
	);

	ray r = ray(
		vec3(taa_offset(), 0.0), // position
		vec3(0.0, 0.0, 1.0) // direction
	);

	ray_plane_intersection_result i = ray_plane_intersection(r, p);

	out_depth = depth < 1.0 ? 1.0 : 0.0;
}