#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/math.glsl

/* lomo:pipeline/post.frag */

uniform sampler2D u_reflective;

uniform sampler2D u_main;
uniform sampler2D u_depth;

in vec2 _cvv_texcoord;
out vec4 out_color;

struct reflection_result {
	bool success;
	vec4 color;
	vec3 position;
	vec3 normal;
};

#define CELL_SIZE 4

const int last_level = 5;

// very dumb'ish, need to rethink
float dist_f(float v0, float cell_size, float d) {
	float s = sign(d);
	float fr = fract(v0 / cell_size) * cell_size;
	const float E = 0.01;
	const float C = 1.0 + E;

	if(fr <= E) return s * cell_size * C;
	if(s > 0.0) return (cell_size - fr) * C;
	return -fr * C;
}

// finds farthest pixel z point in window space
// for camera-space position, normal
float farthest_z(
	// fract(position) should be == vec3(0.5)
	vec3 position,
	vec3 normal,
	mat4 proj
) {
	vec3 x = vec3(
		1, 0, -normal.x/normal.z
	);

	vec3 y = vec3(
		0, 1, -normal.y/normal.z
	);

	vec3 x_ws = cam_dir_to_win(position, x, proj);
	vec3 y_ws = cam_dir_to_win(position, y, proj);

	return max4(
		plane_z(x_ws, y_ws, vec2(-0.5, -0.5)),
		plane_z(x_ws, y_ws, vec2(-0.5,  0.5)),
		plane_z(x_ws, y_ws, vec2( 0.5, -0.5)),
		plane_z(x_ws, y_ws, vec2( 0.5,  0.5))
	);
}

ivec2 texture_coord(vec3 coord_lod_0, float cell_size) {
	return ivec2(coord_lod_0.xy / cell_size);
}

float upper_depth(ivec2 coord, int lod) {
	if(lod < last_level)
		return texelFetch(u_depth, coord / CELL_SIZE, lod + 1).r;
	return 0.0;
}

reflection_result reflection(vec3 dir, vec3 pos) {
	// that's possible
	dir = avoid_zero_components(dir);

	vec2 dir_xy = normalize(dir.xy);

	// primary axis in window space
	int prim = abs(dir_xy.x) >= abs(dir_xy.y) ? 0 : 1;
	// secondary
	int sec = 1 - prim;

	ivec2 idir = ivec2(sign(dir_xy));

	float sec_to_prim = dir_xy[sec] / dir_xy[prim];
	float dist_per_prim = 1.0 / dir_xy[prim];
	float dist_per_sec = 1.0 / dir_xy[sec];

	// current window space position
	pos.xy = floor(pos.xy) + vec2(0.5);

	int lod = 0;
	// will be 1 for lod 0, 4 for 1, 16 for 2, etc,
	// or pow(CELL_SIZE, lod)
	float cell_size = 1;
	// texture coord for current lod
	ivec2 coord = texture_coord(pos, cell_size);

	float upper_depth_ws = 0.0;

	bool backwards = dir.z <= 0.0;
	float dir_xy_length = length(dir.xy);
	float dir_z_per_xy = dir.z / dir_xy_length;
	vec3 prev = pos;

	int steps = 0;
	while(true) {
		// should we use lower lod?
		float depth_ws = texelFetch(u_depth, coord, lod).r;
		while((pos.z > depth_ws || (!backwards && pos.z == depth_ws)) && lod > 0) {
			--lod;
			cell_size /= CELL_SIZE;
			coord = texture_coord(pos, cell_size);
			upper_depth_ws = depth_ws;
			depth_ws = texelFetch(u_depth, coord, lod).r;
		}

		// should we use higher lod?
		while((pos.z < upper_depth_ws || (backwards && pos.z == upper_depth_ws)) && lod < last_level) {
			++lod;
			cell_size *= CELL_SIZE;
			coord = texture_coord(pos, cell_size);
			depth_ws = upper_depth_ws;
			upper_depth_ws = upper_depth(coord, lod);
		}

		vec3 next = vec3(0);

		while(true) {
			float prim_dist = dist_f(pos[prim], cell_size, dir_xy[prim]);
			float sec_dist = dist_f(pos[sec], cell_size, dir_xy[sec]);

			float sec_to_prim0 = sec_dist / prim_dist;

			float dist_add = 0;
			if(abs(sec_to_prim0) < abs(sec_to_prim))
				dist_add = sec_dist * dist_per_sec;
			else
				dist_add = prim_dist * dist_per_prim;

			next = pos;
			next.xy += dir_xy*dist_add;
			next.z += dist_add*dir_z_per_xy;

			bool collides = pos.z >= depth_ws || next.z >= depth_ws;

			// yeah, i could simplify this and next statement
			// but AMD driver crashes because of that :concern:
			if(lod == 0) {
				if(collides) {
					vec4 packed_normal = texelFetch(u_reflective, coord, 0);
					vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);

					vec3 normal_cs = raw_normal_to_cam(normal, frx_viewMatrix());

					vec3 mid = (pos + next)/2.0;
					vec2 mid_center_ws = floor(mid.xy) + vec2(0.5);
					vec3 normal_origin_ws = 
						vec3(
							mid_center_ws,
							depth_ws
						);
					vec3 normal_origin_cs = win_to_cam(normal_origin_ws, frx_projectionMatrix());

					float f = farthest_z(
						normal_origin_cs, normal_cs, frx_projectionMatrix()
					);

					if(
						length(packed_normal.xyz) > 0.5
						&&
						(
							(!backwards && pos.z  > depth_ws+f*4)
							||
							( backwards && next.z > depth_ws+f*4)
						)
					) {
						return reflection_result(false, vec4(0), vec3(0), vec3(0));
					}

					vec4 color = texelFetch(u_main, coord, 0);
					return reflection_result(
						true,
						color,
						mid,
						normal_cs
					);
				}
				break;
			}

			if(!collides || backwards)
				break;

			--lod;
			cell_size /= CELL_SIZE;
			coord = texture_coord(pos, cell_size);
			upper_depth_ws = depth_ws;
			depth_ws = texelFetch(u_depth, coord, lod).r;
		}

		prev = pos;
		pos = next;
		coord = texture_coord(pos, cell_size);

		int cells = int(cell_size * CELL_SIZE);

		if(ivec2(prev) / cells != ivec2(pos) / cells)
			upper_depth_ws = upper_depth(coord, lod);

		if(
			++steps > 80 ||
			pos.x <= 0.0 || pos.x >= frxu_size.x ||
			pos.y <= 0.0 || pos.y >= frxu_size.y ||
			pos.z <= 0.0 || pos.z >= 1.0
		) {
			return reflection_result(false, vec4(0.0), vec3(0), vec3(0));
		}
	}
}

void main() {
	vec4 color = vec4(0);
	float ratio = 0;
	
	vec4 packed_normal = texture2D(u_reflective, _cvv_texcoord);
	if(packed_normal.a != 0) {
		vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);
		mat4 view = frx_viewMatrix();
		mat4 proj = frx_projectionMatrix();

		float depth_ws = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r ;
		vec3 position_ws = vec3(gl_FragCoord.xy, depth_ws);
		vec3 position_cs = win_to_cam(position_ws, proj);

		vec3 normal_cs = raw_normal_to_cam(normal, view);

		vec3 reflection_dir = reflect(normalize(position_cs), normal_cs);

		vec3 dir_ws = cam_dir_to_win(position_cs, reflection_dir, proj);

		// applying z offset, dumb'ish
		float z_per_xy = dir_ws.z / length(dir_ws.xy);
		position_ws.z -= abs(z_per_xy)*3;

		reflection_result res = reflection(dir_ws, position_ws);

		if(res.success) {
			color = res.color;
			vec2 p = abs((res.position.xy / frxu_size) * 2.0 - 1.0);
			float v = 1.0 - max(p.x, p.y);
			if(v > 0.5)
				ratio = 1;
			else
				ratio = smoothstep(0, 0.5, v);

			ratio *= length(cross(reflection_dir, normal_cs));
			//ratio *= packed_normal.a;
		}
	}

	out_color = mix(texture(u_main, _cvv_texcoord), color, ratio);
}