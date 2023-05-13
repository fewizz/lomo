#include frex:shaders/api/view.glsl
#include lomo:shaders/lib/linear.glsl

uniform sampler2D u_depth;

layout(location = 0) out vec3 out_normal;

void main() {
	float depth = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;

	vec2 pos_win = gl_FragCoord.xy;
	vec3 pos_cam = win_to_cam(vec3(pos_win, depth));

	float xs[2] = float[2](
		texelFetch(u_depth, ivec2(pos_win) + ivec2(-1,  0), 0).r,
		texelFetch(u_depth, ivec2(pos_win) + ivec2( 1,  0), 0).r
	);
	int closest_x = abs(depth - xs[0]) < abs(depth - xs[1]) ? 0 : 1;

	float ys[2] = float[2](
		texelFetch(u_depth, ivec2(pos_win) + ivec2( 0, -1), 0).r,
		texelFetch(u_depth, ivec2(pos_win) + ivec2( 0,  1), 0).r
	);
	int closest_y = abs(depth - ys[0]) < abs(depth - ys[1]) ? 0 : 1;

	vec3 x = win_to_cam(
		vec3(pos_win + vec2(closest_x * 2 - 1, 0.0), xs[closest_x])
	);

	vec3 y = win_to_cam(
		vec3(pos_win + vec2(0.0, closest_y * 2 - 1), ys[closest_y])
	);

	vec3 normal = normalize(cross(x - pos_cam, y - pos_cam));

	out_normal = normal * sign(closest_x * 2 - 1) * sign(closest_y * 2 - 1);
}